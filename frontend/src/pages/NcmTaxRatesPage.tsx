import { createColumnHelper } from '@tanstack/react-table'
import { startTransition, useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { buildNcmTaxRatesExportUrl, fetchNcmTaxRates } from '../api'
import { DataTable } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { LoadingBlock } from '../components/LoadingBlock'
import { MetricCard } from '../components/MetricCard'
import { useCompanyContext } from '../context/CompanyContext'
import { useReportRequest } from '../hooks/useReportRequest'
import type { NcmTaxRateRow, TableColumn } from '../types'
import { formatRate, normalizeSearchTerm } from '../utils'

const columnHelper = createColumnHelper<NcmTaxRateRow>()

function buildColumns(
  variations: Record<string, number>,
): TableColumn<NcmTaxRateRow>[] {
  return [
    columnHelper.accessor('ncm', {
      header: 'NCM',
      cell: (info) => {
        const value = info.getValue()
        return (
          <span>
            {value}
            {variations[value] > 1 ? <span className="pill-variation">Variação</span> : null}
          </span>
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

export function NcmTaxRatesPage() {
  const { selectedCompany } = useCompanyContext()
  const [searchParams] = useSearchParams()
  const ncmParam = searchParams.get('ncm') ?? ''
  const initialOnlyVariation =
    searchParams.get('variation') === '1' || searchParams.get('onlyVariation') === 'true'

  return (
    <NcmTaxRatesContent
      key={`${selectedCompany ?? 'none'}:${ncmParam}:${initialOnlyVariation}`}
      selectedCompany={selectedCompany}
      initialSearch={ncmParam}
      initialOnlyVariation={initialOnlyVariation}
    />
  )
}

interface NcmTaxRatesContentProps {
  selectedCompany: string | null
  initialSearch: string
  initialOnlyVariation: boolean
}

function NcmTaxRatesContent({
  selectedCompany,
  initialSearch,
  initialOnlyVariation,
}: NcmTaxRatesContentProps) {
  const { data, error, isLoading } = useReportRequest(selectedCompany, fetchNcmTaxRates)
  const [, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(initialSearch)
  const [onlyVariation, setOnlyVariation] = useState(initialOnlyVariation)
  const deferredSearch = useDeferredValue(search)

  const rows = data?.rows ?? []
  const variations: Record<string, number> = {}
  for (const row of rows) {
    variations[row.ncm] = (variations[row.ncm] ?? 0) + 1
  }

  const repeatedNcmCount = Object.values(variations).filter((count) => count > 1).length
  const normalizedQuery = normalizeSearchTerm(deferredSearch)
  const filteredRows = rows.filter((row) => {
    if (onlyVariation && (variations[row.ncm] ?? 0) <= 1) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return normalizeSearchTerm(row.ncm).includes(normalizedQuery)
  })

  function handleSearchChange(nextValue: string) {
    setSearch(nextValue)
    startTransition(() => {
      if (nextValue.trim()) {
        setSearchParams({ ncm: nextValue.trim() }, { replace: true })
      } else if (onlyVariation) {
        setSearchParams({ variation: '1' }, { replace: true })
      } else {
        setSearchParams({}, { replace: true })
      }
    })
  }

  function handleVariationChange(nextValue: boolean) {
    setOnlyVariation(nextValue)
    startTransition(() => {
      const params: Record<string, string> = {}
      if (search.trim()) {
        params.ncm = search.trim()
      }
      if (nextValue) {
        params.variation = '1'
      }
      setSearchParams(params, { replace: true })
    })
  }

  function handleExport() {
    if (!selectedCompany) {
      return
    }
    window.location.assign(
      buildNcmTaxRatesExportUrl(selectedCompany, {
        search,
        onlyVariation,
      }),
    )
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">NCM e Alíquotas</h2>
          <p className="panel-copy">
            Leitura fiscal consolidada por combinação distinta de NCM, ICMS, IPI, PIS e
            COFINS. NCMs repetidos são destacados quando o cadastro tiver mais de uma
            combinação tributária.
          </p>
        </div>

        <div className="report-meta">
          <span className="badge">Empresa: {selectedCompany ?? '-'}</span>
          <span className="badge">
            Exibindo {filteredRows.length} de {data?.summary.totalRows ?? 0} registros
          </span>
        </div>
      </header>

      <div className="metrics-grid">
        <MetricCard
          label="Linhas fiscais"
          value={data?.summary.totalRows ?? 0}
          tone="accent"
        />
        <MetricCard
          label="NCMs distintos"
          value={data?.summary.distinctNcms ?? 0}
          tone="secondary"
        />
        <MetricCard
          label="Linhas repetidas de NCM"
          value={data?.summary.duplicateNcmRows ?? 0}
          tone={(data?.summary.duplicateNcmRows ?? 0) > 0 ? 'danger' : 'default'}
        />
        <MetricCard
          label="NCMs com variação"
          value={repeatedNcmCount}
          note="Quantidade de NCMs com duas ou mais combinações tributárias."
        />
      </div>

      <div className="filters-grid">
        <div className="field-stack">
          <label htmlFor="ncm-search">Buscar por NCM</label>
          <input
            id="ncm-search"
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Ex.: 38099190"
          />
        </div>

        <div className="field-stack">
          <label htmlFor="ncm-variation-summary">Resumo</label>
          <input
            id="ncm-variation-summary"
            type="text"
            value={`${repeatedNcmCount} NCMs com variação`}
            disabled
          />
        </div>

        <label className="checkbox-toggle">
          <input
            type="checkbox"
            checked={onlyVariation}
            onChange={(event) => handleVariationChange(event.target.checked)}
          />
          Somente NCM com variação
        </label>

        <button type="button" className="action-button" onClick={handleExport}>
          Exportar Excel filtrado
        </button>
      </div>

      <p className="footer-note">
        Mesmo NCM pode aparecer mais de uma vez quando existir mais de uma classificação
        fiscal com alíquotas diferentes no cadastro.
      </p>

      {isLoading ? <LoadingBlock /> : null}
      {error ? (
        <section className="error-state">
          <h3 className="error-title">Falha ao carregar o relatório</h3>
          <p className="error-copy">{error}</p>
        </section>
      ) : null}

      {!isLoading && !error && data?.summary.totalRows === 0 ? (
        <EmptyState
          title="Nenhum dado fiscal encontrado"
          copy="A empresa selecionada ainda não possui linhas fiscais disponíveis para este relatório."
        />
      ) : null}

      {!isLoading && !error && data && data.summary.totalRows > 0 ? (
        <DataTable
          columns={buildColumns(variations)}
          data={filteredRows}
          emptyMessage="Nenhum NCM encontrado para os filtros atuais."
          getRowClassName={(row) => ((variations[row.ncm] ?? 0) > 1 ? 'table-row-emphasis' : '')}
        />
      ) : null}
    </section>
  )
}
