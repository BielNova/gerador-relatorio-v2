import { createColumnHelper } from '@tanstack/react-table'
import { startTransition, useDeferredValue, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { buildProductsFinishedExportUrl, fetchProductsFinished } from '../api'
import { DataTable } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { LoadingBlock } from '../components/LoadingBlock'
import { MetricCard } from '../components/MetricCard'
import { useCompanyContext } from '../context/CompanyContext'
import { useReportRequest } from '../hooks/useReportRequest'
import type { ProductsFinishedRow, TableColumn } from '../types'
import { formatRate, normalizeSearchTerm } from '../utils'

const columnHelper = createColumnHelper<ProductsFinishedRow>()

function buildColumns(
  onNcmClick: (ncm: string) => void,
): TableColumn<ProductsFinishedRow>[] {
  return [
    columnHelper.accessor('code', {
      header: 'Código',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('description', {
      header: 'Descrição',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('group', {
      header: 'Grupo',
      cell: (info) => info.getValue() ?? 'Sem grupo',
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor('ncm', {
      header: 'NCM',
      cell: (info) => {
        const ncm = info.getValue()
        if (!ncm) {
          return <span className="pill-empty">Sem NCM</span>
        }
        return (
          <button type="button" className="text-button" onClick={() => onNcmClick(ncm)}>
            {ncm}
          </button>
        )
      },
    }),
    columnHelper.accessor('icmsRate', {
      header: 'ICMS',
      cell: (info) => formatRate(info.getValue()),
    }),
    columnHelper.accessor('ipiRate', {
      header: 'IPI',
      cell: (info) => formatRate(info.getValue()),
    }),
    columnHelper.accessor('pisRate', {
      header: 'PIS',
      cell: (info) => formatRate(info.getValue()),
    }),
    columnHelper.accessor('cofinsRate', {
      header: 'COFINS',
      cell: (info) => formatRate(info.getValue()),
    }),
  ]
}

export function ProductsFinishedPage() {
  const { selectedCompany } = useCompanyContext()
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''
  const initialGroup = searchParams.get('group') ?? ''
  const initialOnlyMissingNcm =
    searchParams.get('missingNcm') === '1' || searchParams.get('onlyMissingNcm') === 'true'

  return (
    <ProductsFinishedContent
      key={`${selectedCompany ?? 'none'}:${initialSearch}:${initialGroup}:${initialOnlyMissingNcm}`}
      selectedCompany={selectedCompany}
      initialSearch={initialSearch}
      initialGroup={initialGroup}
      initialOnlyMissingNcm={initialOnlyMissingNcm}
    />
  )
}

interface ProductsFinishedContentProps {
  selectedCompany: string | null
  initialSearch: string
  initialGroup: string
  initialOnlyMissingNcm: boolean
}

function ProductsFinishedContent({
  selectedCompany,
  initialSearch,
  initialGroup,
  initialOnlyMissingNcm,
}: ProductsFinishedContentProps) {
  const navigate = useNavigate()
  const { data, error, isLoading } = useReportRequest(selectedCompany, fetchProductsFinished)
  const [search, setSearch] = useState(initialSearch)
  const [groupFilter, setGroupFilter] = useState(initialGroup)
  const [onlyMissingNcm, setOnlyMissingNcm] = useState(initialOnlyMissingNcm)
  const deferredSearch = useDeferredValue(search)

  const rows = data?.rows ?? []
  const normalizedQuery = normalizeSearchTerm(deferredSearch)
  const groupOptions = Array.from(
    new Set(rows.map((row) => row.group).filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right, 'pt-BR'))

  const filteredRows = rows.filter((row) => {
    if (groupFilter && row.group !== groupFilter) {
      return false
    }

    if (onlyMissingNcm && row.ncm) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return [row.code, row.description, row.group ?? '', row.ncm ?? ''].some((value) =>
      normalizeSearchTerm(value).includes(normalizedQuery),
    )
  })

  function handleExport() {
    if (!selectedCompany) {
      return
    }

    window.location.assign(
      buildProductsFinishedExportUrl(selectedCompany, {
        search,
        group: groupFilter,
        onlyMissingNcm,
      }),
    )
  }

  function handleNcmClick(ncm: string) {
    startTransition(() => {
      navigate(`/ncm-tax-rates?ncm=${encodeURIComponent(ncm)}`)
    })
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Produtos Acabados</h2>
          <p className="panel-copy">
            Catálogo fiscal dos produtos acabados ativos, já com NCM e alíquotas da
            classificação fiscal vinculada ao produto.
          </p>
        </div>

        <div className="report-meta">
          <span className="badge">Empresa: {selectedCompany ?? '-'}</span>
          <span className={`badge${data?.summary.missingNcmRows ? ' alert' : ''}`}>
            Exibindo {filteredRows.length} de {data?.summary.totalRows ?? 0} registros
          </span>
        </div>
      </header>

      <div className="metrics-grid">
        <MetricCard
          label="Produtos acabados"
          value={data?.summary.totalRows ?? 0}
          tone="accent"
        />
        <MetricCard
          label="Grupos distintos"
          value={data?.summary.groupCount ?? 0}
          tone="secondary"
        />
        <MetricCard
          label="Produtos sem NCM"
          value={data?.summary.missingNcmRows ?? 0}
          tone={data?.summary.missingNcmRows ? 'danger' : 'default'}
          note="Esses itens pedem revisão do cadastro fiscal."
        />
        <MetricCard
          label="Registros visíveis"
          value={filteredRows.length}
          note="Resultado após busca e filtros aplicados."
        />
      </div>

      <div className="filters-grid">
        <div className="field-stack">
          <label htmlFor="products-search">Busca geral</label>
          <input
            id="products-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Código, descrição, grupo ou NCM"
          />
        </div>

        <div className="field-stack">
          <label htmlFor="products-group-filter">Grupo</label>
          <select
            id="products-group-filter"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
          >
            <option value="">Todos os grupos</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>

        <label className="checkbox-toggle">
          <input
            type="checkbox"
            checked={onlyMissingNcm}
            onChange={(event) => setOnlyMissingNcm(event.target.checked)}
          />
          Somente sem NCM
        </label>

        <button type="button" className="action-button" onClick={handleExport}>
          Exportar Excel filtrado
        </button>
      </div>

      {isLoading ? <LoadingBlock /> : null}
      {error ? (
        <section className="error-state">
          <h3 className="error-title">Falha ao carregar o relatório</h3>
          <p className="error-copy">{error}</p>
        </section>
      ) : null}

      {!isLoading && !error && data?.summary.totalRows === 0 ? (
        <EmptyState
          title="Nenhum produto acabado disponível"
          copy="A empresa selecionada ainda não possui dados para este relatório. Escolha outra empresa ou aguarde a carga."
        />
      ) : null}

      {!isLoading && !error && data && data.summary.totalRows > 0 ? (
        <DataTable
          columns={buildColumns(handleNcmClick)}
          data={filteredRows}
          emptyMessage="Nenhum produto encontrado para os filtros atuais."
        />
      ) : null}
    </section>
  )
}
