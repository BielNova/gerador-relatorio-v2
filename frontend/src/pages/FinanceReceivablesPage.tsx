import { createColumnHelper } from '@tanstack/react-table'
import { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  buildFinanceReceivablesExportUrl,
  fetchFinanceDashboard,
  fetchFinanceReceivables,
} from '../api'
import { DataTable } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { LoadingBlock } from '../components/LoadingBlock'
import { MetricCard } from '../components/MetricCard'
import { useCompanyContext } from '../context/CompanyContext'
import type {
  FinanceCategoryMetric,
  FinanceAuditMetric,
  FinanceDashboardResponse,
  FinancePeriodMode,
  FinanceProjectionPoint,
  FinanceReceivableRow,
  FinanceReceivablesResponse,
  TableColumn,
} from '../types'
import { formatCurrency, formatDate, formatDecimal, formatInteger } from '../utils'

const columnHelper = createColumnHelper<FinanceReceivableRow>()

const columns: TableColumn<FinanceReceivableRow>[] = [
  columnHelper.accessor('boletoCode', {
    header: 'Boleto',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('titleCode', {
    header: 'Titulo',
    cell: (info) => info.getValue() ?? '-',
  }),
  columnHelper.accessor('contract', {
    header: 'Contrato',
    cell: (info) => info.getValue() ?? '-',
  }),
  columnHelper.accessor('installment', {
    header: 'Parcela',
    cell: (info) => info.getValue() ?? '-',
  }),
  columnHelper.accessor('personName', {
    header: 'Cliente',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('paymentMethod', {
    header: 'Forma',
    cell: (info) => info.getValue() ?? '-',
  }),
  columnHelper.accessor('dueDate', {
    header: 'Vencimento',
    cell: (info) => formatDate(info.getValue()),
  }),
  columnHelper.accessor('amount', {
    header: 'Valor',
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor('daysOverdue', {
    header: 'Dias vencidos',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('bankDocument', {
    header: 'Nosso numero',
    cell: (info) => info.getValue() ?? '-',
  }),
  columnHelper.accessor('statusLabel', {
    header: 'Status',
    cell: (info) => <span className="pill-empty">{info.getValue()}</span>,
  }),
]

const periodOptions: Array<{ value: FinancePeriodMode; label: string }> = [
  { value: 'month', label: 'Ultimos 30 dias' },
  { value: 'quarter', label: 'Ultimos 90 dias' },
  { value: 'year', label: 'Ultimos 365 dias' },
]

export function FinanceReceivablesPage() {
  const { selectedCompany } = useCompanyContext()
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''
  const initialOnlyOverdue =
    searchParams.get('overdue') === '1' || searchParams.get('onlyOverdue') === 'true'
  const initialDueEnd = searchParams.get('dueEnd') ?? buildDefaultDueEnd()
  const initialReferenceDate = searchParams.get('referenceDate') ?? buildDefaultReferenceDate()
  const initialPeriodMode = parsePeriodMode(searchParams.get('period'))

  return (
    <FinanceReceivablesContent
      key={`${selectedCompany ?? 'none'}:${initialSearch}:${initialOnlyOverdue}:${initialDueEnd}:${initialReferenceDate}:${initialPeriodMode}`}
      selectedCompany={selectedCompany}
      initialSearch={initialSearch}
      initialOnlyOverdue={initialOnlyOverdue}
      initialDueEnd={initialDueEnd}
      initialReferenceDate={initialReferenceDate}
      initialPeriodMode={initialPeriodMode}
    />
  )
}

interface FinanceReceivablesContentProps {
  selectedCompany: string | null
  initialSearch: string
  initialOnlyOverdue: boolean
  initialDueEnd: string
  initialReferenceDate: string
  initialPeriodMode: FinancePeriodMode
}

function FinanceReceivablesContent({
  selectedCompany,
  initialSearch,
  initialOnlyOverdue,
  initialDueEnd,
  initialReferenceDate,
  initialPeriodMode,
}: FinanceReceivablesContentProps) {
  const [, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(initialSearch)
  const [onlyOverdue, setOnlyOverdue] = useState(initialOnlyOverdue)
  const [dueEnd, setDueEnd] = useState(initialDueEnd)
  const [referenceDate, setReferenceDate] = useState(initialReferenceDate)
  const [periodMode, setPeriodMode] = useState<FinancePeriodMode>(initialPeriodMode)
  const [dashboard, setDashboard] = useState<FinanceDashboardResponse | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [data, setData] = useState<FinanceReceivablesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const deferredSearch = useDeferredValue(search)

  const loadDashboard = useEffectEvent(async () => {
    if (!selectedCompany) {
      setDashboard(null)
      setDashboardError(null)
      return
    }

    setDashboardLoading(true)
    setDashboardError(null)
    try {
      const response = await fetchFinanceDashboard(selectedCompany, {
        referenceDate,
        period: periodMode,
      })
      setDashboard(response)
    } catch (err) {
      setDashboard(null)
      setDashboardError(err instanceof Error ? err.message : 'Erro ao carregar dashboard financeiro.')
    } finally {
      setDashboardLoading(false)
    }
  })

  const loadReceivables = useEffectEvent(async () => {
    if (!selectedCompany) {
      setData(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchFinanceReceivables(selectedCompany, {
        search: deferredSearch,
        onlyOverdue,
        dueEnd,
        referenceDate,
      })
      setData(response)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Erro ao carregar contas a receber.')
    } finally {
      setIsLoading(false)
    }
  })

  useEffect(() => {
    void loadDashboard()
  }, [selectedCompany, referenceDate, periodMode])

  useEffect(() => {
    void loadReceivables()
  }, [selectedCompany, deferredSearch, onlyOverdue, dueEnd])

  function updateUrl(
    nextSearch: string,
    nextOnlyOverdue: boolean,
    nextDueEnd: string,
    nextReferenceDate: string,
    nextPeriodMode: FinancePeriodMode,
  ) {
    startTransition(() => {
      const params: Record<string, string> = {}
      if (nextSearch.trim()) {
        params.search = nextSearch.trim()
      }
      if (nextOnlyOverdue) {
        params.overdue = '1'
      }
      if (nextDueEnd) {
        params.dueEnd = nextDueEnd
      }
      if (nextReferenceDate) {
        params.referenceDate = nextReferenceDate
      }
      params.period = nextPeriodMode
      setSearchParams(params, { replace: true })
    })
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    updateUrl(value, onlyOverdue, dueEnd, referenceDate, periodMode)
  }

  function handleOnlyOverdueChange(value: boolean) {
    setOnlyOverdue(value)
    updateUrl(search, value, dueEnd, referenceDate, periodMode)
  }

  function handleDueEndChange(value: string) {
    setDueEnd(value)
    updateUrl(search, onlyOverdue, value, referenceDate, periodMode)
  }

  function handleReferenceDateChange(value: string) {
    setReferenceDate(value)
    updateUrl(search, onlyOverdue, dueEnd, value, periodMode)
  }

  function handlePeriodModeChange(value: FinancePeriodMode) {
    setPeriodMode(value)
    updateUrl(search, onlyOverdue, dueEnd, referenceDate, value)
  }

  function handleExport() {
    if (!selectedCompany) {
      return
    }
    window.location.assign(
      buildFinanceReceivablesExportUrl(selectedCompany, {
        search,
        onlyOverdue,
        dueEnd,
        referenceDate,
      }),
    )
  }

  const rows = data?.rows ?? []
  const maxDebtorAmount = Math.max(...(data?.topDebtors.map((item) => item.overdueAmount) ?? [0]), 1)

  return (
    <section className="dashboard-stack">
      <section className="panel finance-hero-panel">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Dashboard Financeiro</h2>
            <p className="panel-copy">
              Visao por blocos: caixa, fluxo, contas a pagar, contas a receber,
              DRE simplificado, inadimplencia, projecao, indicadores e alertas.
            </p>
          </div>
          <div className="report-meta">
            <span className="badge">Empresa: {selectedCompany ?? '-'}</span>
            <span className="badge">Referencia: {formatDate(dashboard?.referenceDate)}</span>
          </div>
        </header>

        <div className="filters-grid finance-dashboard-controls">
          <div className="field-stack">
            <label htmlFor="finance-reference-date">Data de referencia</label>
            <input
              id="finance-reference-date"
              type="date"
              value={referenceDate}
              onChange={(event) => handleReferenceDateChange(event.target.value)}
            />
          </div>

          <div className="field-stack finance-period-field">
            <span>Janela de analise</span>
            <div className="period-toggle" aria-label="Janela de analise por periodo">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === periodMode ? 'active' : ''}
                  onClick={() => handlePeriodModeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {dashboardLoading ? <LoadingBlock title="Carregando dashboard financeiro" /> : null}
        {dashboardError ? (
          <section className="error-state">
            <h3 className="error-title">Falha ao carregar o dashboard financeiro</h3>
            <p className="error-copy">{dashboardError}</p>
          </section>
        ) : null}

        {!dashboardLoading && !dashboardError && dashboard ? (
          <FinanceDashboardPanels dashboard={dashboard} onSelectCustomer={handleSearchChange} />
        ) : null}
      </section>

      <section className="panel">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">Contas a Receber: detalhe operacional</h2>
            <p className="panel-copy">
              Lista de boletos em aberto a partir do FNBOLETO. O recorte padrao inclui
              vencidos e proximos 30 dias.
            </p>
          </div>

          <div className="report-meta">
            <span className={`badge${data?.summary.overdueRows ? ' alert' : ''}`}>
              Exibindo {formatInteger(data?.summary.filteredRows ?? 0)} registros
            </span>
          </div>
        </header>

        <div className="filters-grid finance-filters-grid">
          <div className="field-stack">
            <label htmlFor="finance-search">Busca geral</label>
            <input
              id="finance-search"
              type="search"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Cliente, boleto, titulo, contrato ou nosso numero"
            />
          </div>

          <div className="field-stack">
            <label htmlFor="finance-due-end">Vencimento ate</label>
            <input
              id="finance-due-end"
              type="date"
              value={dueEnd}
              onChange={(event) => handleDueEndChange(event.target.value)}
            />
          </div>

          <label className="checkbox-toggle">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={(event) => handleOnlyOverdueChange(event.target.checked)}
            />
            Somente vencidos
          </label>

          <button type="button" className="action-button" onClick={handleExport}>
            Exportar Excel filtrado
          </button>
        </div>

        {isLoading ? <LoadingBlock title="Carregando contas a receber" /> : null}
        {error ? (
          <section className="error-state">
            <h3 className="error-title">Falha ao carregar o financeiro</h3>
            <p className="error-copy">{error}</p>
          </section>
        ) : null}

        {!isLoading && !error && data?.rows.length === 0 ? (
          <EmptyState
            title="Nenhum boleto encontrado"
            copy="Ajuste os filtros de vencimento, busca ou empresa para encontrar contas a receber."
          />
        ) : null}

        {!isLoading && !error && data && data.rows.length > 0 ? (
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="Nenhum boleto encontrado para os filtros atuais."
            getRowClassName={(row) => (row.daysOverdue > 0 ? 'table-row-emphasis' : '')}
          />
        ) : null}
      </section>

      {data && data.topDebtors.length > 0 ? (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">Top inadimplentes no filtro</h2>
              <p className="panel-copy">
                Ranking por valor vencido dentro da lista detalhada. Use a busca para isolar um cliente.
              </p>
            </div>
          </header>

          <div className="ranking-list">
            {data.topDebtors.map((debtor) => (
              <button
                key={debtor.personCode}
                type="button"
                className="ranking-row ranking-button"
                onClick={() => handleSearchChange(debtor.personName)}
              >
                <span>{debtor.personName}</span>
                <strong>{formatCurrency(debtor.overdueAmount)}</strong>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.max(6, (debtor.overdueAmount / maxDebtorAmount) * 100)}%` }}
                  />
                </div>
                <small>
                  {formatInteger(debtor.overdueRows)} boletos vencidos - codigo {debtor.personCode}
                </small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  )
}

interface FinanceDashboardPanelsProps {
  dashboard: FinanceDashboardResponse
  onSelectCustomer: (customer: string) => void
}

function FinanceDashboardPanels({ dashboard, onSelectCustomer }: FinanceDashboardPanelsProps) {
  const maxExpense = Math.max(...dashboard.dre.expenseCategories.map((item) => item.amount), 1)
  const maxRevenue = Math.max(...dashboard.dre.revenueEvolution.map((item) => item.revenue), 1)
  const maxPayableCategory = Math.max(...dashboard.payables.byCategory.map((item) => item.amount), 1)
  const maxAgingAmount = Math.max(...dashboard.receivables.aging.map((item) => item.amount), 1)
  const maxDebtorAmount = Math.max(...dashboard.topDebtors.map((item) => item.overdueAmount), 1)
  const dreMonth = formatMonthLabel(dashboard.dre.year, dashboard.dre.month)
  const latestBillingMonth = formatAuditMonth(dashboard.audit.dre.latestInvoiceMonthFromCVFATURA)
  const dreFallbackNote = dashboard.dre.isFallbackMonth
    ? 'Ultimo mes com DRE movimentado; mes atual ainda esta zerado na base.'
    : 'Mes atual da base DRE.'
  const dreStaleNote = dashboard.audit.dre.isStaleComparedToInvoices
    ? ` CVFATURA tem faturamento ate ${latestBillingMonth}.`
    : ''

  return (
    <div className="finance-dashboard-grid">
      <section className="finance-block finance-block-wide">
        <div className="section-heading">
          <h3>Observacao por periodo</h3>
          <p>
            {dashboard.period.label} ate a data de referencia: {formatDate(dashboard.period.startDate)} ate{' '}
            {formatDate(dashboard.period.endDate)}.
          </p>
        </div>
        <div className="metrics-grid compact">
          <MetricCard
            label="Fluxo liquido"
            value={formatCurrency(dashboard.period.cashFlow.net)}
            tone={dashboard.period.cashFlow.net < 0 ? 'danger' : 'accent'}
            note={`Entradas ${formatCurrency(dashboard.period.cashFlow.inflow)} / saidas ${formatCurrency(
              dashboard.period.cashFlow.outflow,
            )}`}
          />
          <MetricCard
            label="Pagar no periodo"
            value={formatCurrency(dashboard.period.payablesDue.amount)}
            tone={dashboard.period.payablesDue.amount > 0 ? 'secondary' : 'default'}
            note={`${formatInteger(dashboard.period.payablesDue.rows)} titulos em aberto`}
          />
          <MetricCard
            label="Receber no periodo"
            value={formatCurrency(dashboard.period.receivablesDue.amount)}
            tone="accent"
            note={`${formatInteger(dashboard.period.receivablesDue.rows)} boletos em aberto`}
          />
          <MetricCard
            label="Recebido no periodo"
            value={formatCurrency(dashboard.period.received.amount)}
            note={`${formatInteger(dashboard.period.received.rows)} recebimentos`}
          />
        </div>
      </section>

      <section className="finance-block finance-block-wide">
        <div className="section-heading">
          <h3>Saldo bancario atual</h3>
          <p>
            Fonte: {dashboard.audit.cash.source}, movimentos ate {formatDate(dashboard.cash.sourceDate)}.
          </p>
        </div>
        <div className="metrics-grid compact">
          <MetricCard label="Saldo bancario" value={formatCurrency(dashboard.cash.currentCash)} tone="accent" />
          <MetricCard
            label="Saldo consolidado operacional"
            value={formatCurrency(dashboard.cash.consolidatedBalance)}
            tone={dashboard.cash.consolidatedBalance < 0 ? 'danger' : 'secondary'}
            note="Banco + receber bruto - pagar aberto do ano corrente."
          />
          <MetricCard
            label="Disponivel"
            value={formatCurrency(dashboard.cash.availableCash)}
            tone={dashboard.cash.availableCash < 0 ? 'danger' : 'default'}
            note="Saldo bancario menos comprometido em 30 dias."
          />
          <MetricCard
            label="Comprometido"
            value={formatCurrency(dashboard.cash.committedCash)}
            note="Vencidas, hoje e proximos 30 dias."
          />
        </div>
      </section>

      <section className="finance-block">
        <div className="section-heading">
          <h3>Fluxo de caixa</h3>
          <p>Entradas vs saidas por periodo.</p>
        </div>
        <div className="mini-table">
          {dashboard.cashFlow.map((item) => (
            <div key={item.label} className="mini-table-row">
              <strong>{item.label}</strong>
              <span>Entradas {formatCurrency(item.inflow)}</span>
              <span>Saidas {formatCurrency(item.outflow)}</span>
              <span className={item.net < 0 ? 'text-danger' : 'text-positive'}>
                Liquido {formatCurrency(item.net)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="finance-block">
        <div className="section-heading">
          <h3>Projecao financeira</h3>
          <p>Saldo projetado e resultado previsto por janela.</p>
        </div>
        <ProjectionList projections={dashboard.projections} />
      </section>

      <section className="finance-block finance-block-wide">
        <div className="section-heading">
          <h3>Contas a pagar</h3>
          <p>Cards operacionais por vencimento. Total bruto e anomalias ficam na conferencia.</p>
        </div>
        <div className="metrics-grid compact">
          <MetricCard
            label="Vencidas"
            value={formatCurrency(dashboard.payables.overdue.amount)}
            tone={dashboard.payables.overdue.rows ? 'danger' : 'default'}
            note={`${formatInteger(dashboard.payables.overdue.rows)} titulos`}
          />
          <MetricCard
            label="Vencendo hoje"
            value={formatCurrency(dashboard.payables.dueToday.amount)}
            tone={dashboard.payables.dueToday.rows ? 'secondary' : 'default'}
            note={`${formatInteger(dashboard.payables.dueToday.rows)} titulos`}
          />
          <MetricCard
            label="Proximos 7 dias"
            value={formatCurrency(dashboard.payables.next7Days.amount)}
            note={`${formatInteger(dashboard.payables.next7Days.rows)} titulos`}
          />
          <MetricCard
            label="Proximos 15 dias"
            value={formatCurrency(dashboard.payables.next15Days.amount)}
            note={`${formatInteger(dashboard.payables.next15Days.rows)} titulos`}
          />
          <MetricCard
            label="Proximos 30 dias"
            value={formatCurrency(dashboard.payables.next30Days.amount)}
            note={`${formatInteger(dashboard.payables.next30Days.rows)} titulos`}
          />
        </div>
        <div className="period-grid">
          <PeriodTile label="7 dias" metric={dashboard.payables.next7Days} />
          <PeriodTile label="15 dias" metric={dashboard.payables.next15Days} />
          <PeriodTile label="30 dias" metric={dashboard.payables.next30Days} />
        </div>
        <CategoryBars
          title="Pagar por categoria"
          items={dashboard.payables.byCategory}
          maxAmount={maxPayableCategory}
        />
      </section>

      <section className="finance-block finance-block-wide">
        <div className="section-heading">
          <h3>Contas a receber e inadimplencia</h3>
          <p>Separacao entre receber bruto, atraso operacional, legado historico e previsao.</p>
        </div>
        <div className="metrics-grid compact">
          <MetricCard
            label="Em aberto bruto"
            value={formatCurrency(dashboard.receivables.open.amount)}
            tone="accent"
            note={`${formatInteger(dashboard.receivables.open.rows)} boletos`}
          />
          <MetricCard
            label="Inadimplencia operacional"
            value={formatCurrency(dashboard.receivables.operationalOverdue365Days.amount)}
            tone={dashboard.receivables.operationalOverdue365Days.rows ? 'danger' : 'default'}
            note={`${formatInteger(dashboard.receivables.operationalOverdue365Days.rows)} boletos nos ultimos 365 dias`}
          />
          <MetricCard
            label="Inadimplencia legado"
            value={formatCurrency(dashboard.receivables.legacyOverdue365Plus.amount)}
            tone={dashboard.receivables.legacyOverdue365Plus.rows ? 'secondary' : 'default'}
            note={`${formatInteger(dashboard.receivables.legacyOverdue365Plus.rows)} boletos com mais de 365 dias`}
          />
          <MetricCard
            label="Recebidas no dia"
            value={formatCurrency(dashboard.receivables.receivedToday.amount)}
            note={`${formatInteger(dashboard.receivables.receivedToday.rows)} recebimentos`}
          />
          <MetricCard
            label="% sobre faturamento"
            value={formatPercentValue(
              percentageFromValues(
                dashboard.receivables.operationalOverdue365Days.amount,
                dashboard.audit.dre.latestInvoiceRevenueTotal || dashboard.dre.revenueTotal,
              ),
            )}
            tone="secondary"
            note={
              dashboard.audit.dre.latestInvoiceRevenueTotal
                ? `Base: faturamento ${latestBillingMonth}`
                : `Base: DRE ${dreMonth}`
            }
          />
        </div>
        <div className="period-grid">
          <PeriodTile label="Previsao 7 dias" metric={dashboard.receivables.expected7Days} />
          <PeriodTile label="Previsao 15 dias" metric={dashboard.receivables.expected15Days} />
          <PeriodTile label="Previsao 30 dias" metric={dashboard.receivables.expected30Days} />
        </div>

        <CategoryBars
          title="Envelhecimento do receber"
          items={dashboard.receivables.aging.map((item) => ({
            category: item.label,
            amount: item.amount,
            sharePercent: percentageFromValues(item.amount, dashboard.receivables.open.amount) ?? 0,
          }))}
          maxAmount={maxAgingAmount}
        />

        <div className="ranking-list">
          {dashboard.topDebtors.map((debtor) => (
            <button
              key={debtor.personCode}
              type="button"
              className="ranking-row ranking-button"
              onClick={() => onSelectCustomer(debtor.personName)}
            >
              <span>{debtor.personName}</span>
              <strong>{formatCurrency(debtor.overdueAmount)}</strong>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.max(6, (debtor.overdueAmount / maxDebtorAmount) * 100)}%` }}
                />
              </div>
              <small>
                {formatInteger(debtor.overdueRows)} boletos em atraso nos ultimos 365 dias - codigo {debtor.personCode}
              </small>
            </button>
          ))}
        </div>
      </section>

      <section className="finance-block finance-block-wide">
        <div className="section-heading">
          <h3>Resultado simplificado</h3>
          <p>
            DRE de {dreMonth}. {dreFallbackNote}{dreStaleNote}
          </p>
        </div>
        <div className="metrics-grid compact">
          <MetricCard label="Receita total" value={formatCurrency(dashboard.dre.revenueTotal)} tone="accent" />
          <MetricCard
            label="Faturamento CVFATURA"
            value={formatCurrency(dashboard.audit.dre.latestInvoiceRevenueTotal)}
            tone="secondary"
            note={`Ultimo mes com faturamento: ${latestBillingMonth}`}
          />
          <MetricCard label="Custos" value={formatCurrency(dashboard.dre.costs)} />
          <MetricCard label="Despesas" value={formatCurrency(dashboard.dre.expenses)} />
          <MetricCard
            label="Lucro liquido"
            value={formatCurrency(dashboard.dre.netProfit)}
            tone={dashboard.dre.netProfit < 0 ? 'danger' : 'secondary'}
            note={`Lucro bruto ${formatCurrency(dashboard.dre.grossProfit)}`}
          />
        </div>
      </section>

      <section className="finance-block">
        <div className="section-heading">
          <h3>Despesas</h3>
          <p>
            Total do mes {formatCurrency(dashboard.dre.costs + dashboard.dre.expenses)}.
            Comparacao: {formatPercentValue(dashboard.dre.expensesChangePercent)}.
          </p>
        </div>
        <CategoryBars
          title="Distribuicao por categoria"
          items={dashboard.dre.expenseCategories}
          maxAmount={maxExpense}
        />
      </section>

      <section className="finance-block">
        <div className="section-heading">
          <h3>Receitas</h3>
          <p>
            Total do mes {formatCurrency(dashboard.dre.revenueTotal)}.
            Comparacao: {formatPercentValue(dashboard.dre.revenueChangePercent)}.
          </p>
        </div>
        <div className="evolution-strip">
          {dashboard.dre.revenueEvolution.map((point) => (
            <div key={`${point.year}-${point.month}`} className="evolution-item">
              <span>{String(point.month).padStart(2, '0')}/{String(point.year).slice(2)}</span>
              <div className="evolution-bar">
                <div
                  style={{ height: `${Math.max(6, (point.revenue / maxRevenue) * 100)}%` }}
                />
              </div>
              <small>{formatCurrency(point.revenue)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="finance-block">
        <div className="section-heading">
          <h3>Indicadores principais</h3>
          <p>Indicadores iniciais calculados a partir de DRE e recebimentos.</p>
        </div>
        <div className="metrics-grid compact two-columns">
          <MetricCard label="Ticket medio" value={formatOptionalCurrency(dashboard.indicators.averageTicket)} />
          <MetricCard label="Custo fixo mensal" value={formatCurrency(dashboard.indicators.fixedMonthlyCost)} />
          <MetricCard label="Ponto de equilibrio" value={formatOptionalCurrency(dashboard.indicators.breakEvenPoint)} />
          <MetricCard label="Lucratividade" value={formatPercentValue(dashboard.indicators.profitabilityPercent)} />
        </div>
      </section>

      <section className="finance-block">
        <div className="section-heading">
          <h3>Alertas</h3>
          <p>Regras automaticas para risco financeiro.</p>
        </div>
        <div className="alert-list">
          {dashboard.alerts.map((alert) => (
            <article key={`${alert.title}-${alert.detail}`} className={`alert-card ${alert.level}`}>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
              {alert.amount != null ? <span>{formatAlertAmount(alert.amount, alert.title)}</span> : null}
            </article>
          ))}
        </div>
      </section>

      <FinanceAuditPanel dashboard={dashboard} />

      <section className="finance-block finance-block-wide">
        <div className="section-heading">
          <h3>Regras de leitura</h3>
          <p>Notas para conferir a veracidade dos dados com o Arquimedes.</p>
        </div>
        <div className="note-grid">
          {dashboard.dataQualityNotes.map((note) => (
            <span key={note} className="badge">
              {note}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function ProjectionList({ projections }: { projections: FinanceProjectionPoint[] }) {
  return (
    <div className="mini-table">
      {projections.map((projection) => (
        <div key={projection.days} className="mini-table-row">
          <strong>{projection.days} dias - {formatDate(projection.date)}</strong>
          <span>Saldo {formatCurrency(projection.projectedBalance)}</span>
          <span>Receber {formatCurrency(projection.expectedReceivables)}</span>
          <span>Pagar {formatCurrency(projection.expectedPayables)}</span>
          <span className={projection.projectedResult < 0 ? 'text-danger' : 'text-positive'}>
            Resultado {formatCurrency(projection.projectedResult)}
          </span>
        </div>
      ))}
    </div>
  )
}

function FinanceAuditPanel({ dashboard }: { dashboard: FinanceDashboardResponse }) {
  const { audit } = dashboard
  return (
    <section className="finance-block finance-block-wide">
      <div className="section-heading">
        <h3>Conferencia de Dados</h3>
        <p>
          Numeros rastreaveis ao banco em {formatDate(audit.referenceDate)}. O dashboard externo e
          apenas referencia manual, sem dependencia em runtime.
        </p>
      </div>

      <div className="audit-grid">
        <article className="audit-card accent">
          <span>Caixa / banco</span>
          <strong>{formatCurrency(audit.cash.amount)}</strong>
          <small>
            {audit.cash.source}. {formatInteger(audit.cash.accountRows)} contas ativas,
            {' '}{formatInteger(audit.cash.movementRows)} movimentos.
          </small>
          <small>{formatDateRange(audit.cash.startDate, audit.cash.endDate)}</small>
          <small>{audit.cash.rule}</small>
        </article>

        <AuditMetricCard
          title="Pagar bruto aberto"
          metric={audit.payables.rawOpen}
          note="Todos os titulos P sem pagamento."
        />
        <AuditMetricCard
          title="Pagar operacional 30 dias"
          metric={audit.payables.operational30Days}
          note="Vencidas, hoje e proximos 30 dias."
        />
        <AuditMetricCard
          title="Pagar ano corrente"
          metric={audit.payables.currentYearOpen}
          note="Titulos abertos vencendo no ano da referencia."
        />
        <AuditMetricCard
          title="Fora do horizonte"
          metric={audit.payables.futureOutOfHorizon}
          note="Vencimentos apos 30 dias e antes de 2030."
        />
        <AuditMetricCard
          title="Anomalias pagar >= 2030"
          metric={audit.payables.futureAnomalies2030Plus}
          note="Separadas dos KPIs principais."
        />
        <AuditMetricCard
          title="Pagar sem vencimento"
          metric={audit.payables.missingDueDate}
          note="Titulos abertos sem data de vencimento."
        />
        <AuditMetricCard
          title="Receber bruto aberto"
          metric={audit.receivables.rawOpen}
          note="Todos os boletos com BO_PG_ST = 1."
        />
        <AuditMetricCard
          title="Inadimplencia total"
          metric={audit.receivables.overdueTotal}
          note="Boletos abertos vencidos."
        />
        <AuditMetricCard
          title="Inadimplencia operacional"
          metric={audit.receivables.overdueOperational365Days}
          note="Atrasos dos ultimos 365 dias."
        />
        <AuditMetricCard
          title="Inadimplencia legado"
          metric={audit.receivables.overdueLegacy365Plus}
          note="Atrasos com mais de 365 dias."
        />
        <AuditMetricCard
          title="Receber 30 dias"
          metric={audit.receivables.expected30Days}
          note="Previsao em aberto nos proximos 30 dias."
        />

        <article className={`audit-card ${audit.dre.isStaleComparedToInvoices ? 'warning' : ''}`}>
          <span>DRE</span>
          <strong>{formatAuditMonth(audit.dre.dreReferenceMonth)}</strong>
          <small>Receita DRE {formatCurrency(audit.dre.dreRevenueTotal)}.</small>
          <small>
            CVFATURA ate {formatAuditMonth(audit.dre.latestInvoiceMonthFromCVFATURA)} com{' '}
            {formatCurrency(audit.dre.latestInvoiceRevenueTotal)}.
          </small>
          <small>
            {audit.dre.isStaleComparedToInvoices
              ? 'DRE desatualizada em relacao ao faturamento.'
              : 'DRE alinhada ao faturamento disponivel.'}
          </small>
        </article>
      </div>
    </section>
  )
}

function AuditMetricCard({
  title,
  metric,
  note,
}: {
  title: string
  metric: FinanceAuditMetric
  note: string
}) {
  return (
    <article className="audit-card">
      <span>{title}</span>
      <strong>{formatCurrency(metric.amount)}</strong>
      <small>{formatInteger(metric.rows)} registros</small>
      <small>{formatDateRange(metric.startDate, metric.endDate)}</small>
      <small>{note}</small>
    </article>
  )
}

function PeriodTile({ label, metric }: { label: string; metric: { rows: number; amount: number } }) {
  return (
    <article className="period-tile">
      <span>{label}</span>
      <strong>{formatCurrency(metric.amount)}</strong>
      <small>{formatInteger(metric.rows)} registros</small>
    </article>
  )
}

function CategoryBars({
  title,
  items,
  maxAmount,
}: {
  title: string
  items: FinanceCategoryMetric[]
  maxAmount: number
}) {
  if (items.length === 0) {
    return (
      <div className="empty-inline">
        <strong>{title}</strong>
        <span>Nenhuma categoria encontrada.</span>
      </div>
    )
  }

  return (
    <div className="ranking-list">
      <strong className="ranking-title">{title}</strong>
      {items.map((item) => (
        <div key={item.category} className="ranking-row">
          <span>{item.category}</span>
          <strong>{formatCurrency(item.amount)}</strong>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${Math.max(6, (item.amount / maxAmount) * 100)}%` }}
            />
          </div>
          <small>{formatPercentValue(item.sharePercent)} do total</small>
        </div>
      ))}
    </div>
  )
}

function buildDefaultDueEnd(): string {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString().slice(0, 10)
}

function buildDefaultReferenceDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function parsePeriodMode(value: string | null): FinancePeriodMode {
  if (value === 'quarter' || value === 'year') {
    return value
  }
  return 'month'
}

function formatMonthLabel(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year}`
}

function formatAuditMonth(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }
  const [year, month] = value.split('-')
  return month && year ? `${month}/${year}` : value
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) {
    return 'Sem intervalo de data.'
  }
  return `${formatDate(startDate)} ate ${formatDate(endDate)}`
}

function formatPercentValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '-'
  }
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatDecimal(value)}%`
}

function formatOptionalCurrency(value: number | null | undefined): string {
  if (value == null) {
    return '-'
  }
  return formatCurrency(value)
}

function percentageFromValues(value: number, total: number): number | null {
  if (!total) {
    return null
  }
  return (value / total) * 100
}

function formatAlertAmount(value: number, title: string): string {
  if (title.includes('receita') || title.includes('despesas')) {
    return formatPercentValue(value)
  }
  return formatCurrency(value)
}
