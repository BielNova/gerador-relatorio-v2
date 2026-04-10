import type { ColumnDef } from '@tanstack/react-table'

export interface CompanyOption {
  id: string
  label: string
  hasData: boolean
}

export interface BusinessAreaTableMetric {
  name: string
  rows: number
}

export interface BusinessAreaSummary {
  id: string
  label: string
  description: string
  tableCount: number
  totalRows: number
  hasData: boolean
  entryPath: string | null
  tables: BusinessAreaTableMetric[]
}

export interface CompanyOverviewResponse {
  company: string
  summary: {
    areaCount: number
    activeAreaCount: number
    totalRows: number
  }
  areas: BusinessAreaSummary[]
}

// TanStack Table expects heterogeneous column value types in the same array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableColumn<T extends object> = ColumnDef<T, any>

export interface ProductsFinishedRow {
  code: string
  description: string
  group: string | null
  ncm: string | null
  icmsRate: number | null
  ipiRate: number | null
  pisRate: number | null
  cofinsRate: number | null
}

export interface ProductsFinishedResponse {
  company: string
  summary: {
    totalRows: number
    missingNcmRows: number
    groupCount: number
  }
  rows: ProductsFinishedRow[]
}

export interface NcmTaxRateRow {
  ncm: string
  icmsRate: number | null
  ipiRate: number | null
  pisRate: number | null
  cofinsRate: number | null
}

export interface NcmTaxRateResponse {
  company: string
  summary: {
    totalRows: number
    distinctNcms: number
    duplicateNcmRows: number
  }
  rows: NcmTaxRateRow[]
}

export interface FiscalDashboardGroupIssue {
  group: string
  totalRows: number
  missingNcmRows: number
  zeroRateRows: number
  issueRows: number
}

export interface FiscalDashboardResponse {
  company: string
  summary: {
    totalProducts: number
    missingNcmProducts: number
    distinctNcms: number
    ncmVariationCount: number
    duplicateNcmRows: number
    productsWithAnyZeroRate: number
    zeroIcmsProducts: number
    zeroIpiProducts: number
    zeroPisProducts: number
    zeroCofinsProducts: number
  }
  groupIssues: FiscalDashboardGroupIssue[]
}

export interface FinanceReceivableRow {
  boletoCode: string
  titleCode: string | null
  contract: string | null
  installment: string | null
  personCode: string
  personName: string
  paymentMethod: string | null
  dueDate: string | null
  amount: number
  daysOverdue: number
  bankDocument: string | null
  statusCode: number
  statusLabel: string
}

export interface FinanceTopDebtor {
  personCode: string
  personName: string
  overdueRows: number
  overdueAmount: number
}

export interface FinanceReceivablesResponse {
  company: string
  filters: {
    search: string
    onlyOverdue: boolean
    dueEnd: string
  }
  summary: {
    totalOpenRows: number
    totalOpenAmount: number
    overdueRows: number
    overdueAmount: number
    dueNextRows: number
    dueNextAmount: number
    receivedMonthRows: number
    receivedMonthAmount: number
    filteredRows: number
    filteredAmount: number
  }
  topDebtors: FinanceTopDebtor[]
  rows: FinanceReceivableRow[]
}

export interface FinanceAmountMetric {
  rows: number
  amount: number
}

export interface FinanceAgingBucket {
  label: string
  rows: number
  amount: number
  minDaysOverdue: number | null
  maxDaysOverdue: number | null
}

export interface FinanceAuditMetric {
  rows: number
  amount: number
  startDate: string | null
  endDate: string | null
}

export interface FinanceDashboardAudit {
  referenceDate: string
  cash: {
    source: string
    rule: string
    accountRows: number
    movementRows: number
    startDate: string | null
    endDate: string | null
    amount: number
  }
  payables: {
    rawOpen: FinanceAuditMetric
    operational30Days: FinanceAuditMetric
    currentYearOpen: FinanceAuditMetric
    futureOutOfHorizon: FinanceAuditMetric
    missingDueDate: FinanceAuditMetric
    futureAnomalies2030Plus: FinanceAuditMetric
  }
  receivables: {
    rawOpen: FinanceAuditMetric
    overdueTotal: FinanceAuditMetric
    overdueOperational365Days: FinanceAuditMetric
    overdueLegacy365Plus: FinanceAuditMetric
    expected30Days: FinanceAuditMetric
  }
  dre: {
    dreReferenceMonth: string | null
    dreRevenueTotal: number
    latestInvoiceMonthFromCVFATURA: string | null
    latestInvoiceRevenueTotal: number
    isFallbackMonth: boolean
    isStaleComparedToInvoices: boolean
  }
  externalComparison: {
    referenceUrl: string
    runtimeDependency: boolean
    note: string
  }
}

export interface FinanceCashSummary {
  sourceDate: string | null
  currentCash: number
  consolidatedBalance: number
  availableCash: number
  committedCash: number
}

export interface FinanceFlowMetric {
  label: string
  startDate: string
  endDate: string
  inflow: number
  outflow: number
  net: number
}

export type FinancePeriodMode = 'month' | 'quarter' | 'year'

export interface FinanceDashboardPeriod {
  mode: FinancePeriodMode
  label: string
  startDate: string
  endDate: string
  cashFlow: FinanceFlowMetric
  payablesDue: FinanceAmountMetric
  receivablesDue: FinanceAmountMetric
  received: FinanceAmountMetric
}

export interface FinanceProjectionPoint {
  days: number
  date: string
  projectedBalance: number
  expectedReceivables: number
  expectedPayables: number
  projectedResult: number
}

export interface FinanceCategoryMetric {
  category: string
  amount: number
  sharePercent: number
}

export interface FinanceDreEvolutionPoint {
  year: number
  month: number
  revenue: number
  expenses: number
  netProfit: number
}

export interface FinanceDreSummary {
  year: number
  month: number
  isFallbackMonth: boolean
  revenueTotal: number
  costs: number
  expenses: number
  grossProfit: number
  netProfit: number
  revenuePreviousMonth: number
  expensesPreviousMonth: number
  revenueChangePercent: number | null
  expensesChangePercent: number | null
  expenseCategories: FinanceCategoryMetric[]
  revenueCategories: FinanceCategoryMetric[]
  revenueEvolution: FinanceDreEvolutionPoint[]
}

export interface FinanceDashboardResponse {
  company: string
  referenceDate: string
  period: FinanceDashboardPeriod
  cash: FinanceCashSummary
  cashFlow: FinanceFlowMetric[]
  projections: FinanceProjectionPoint[]
  payables: {
    open: FinanceAmountMetric
    overdue: FinanceAmountMetric
    dueToday: FinanceAmountMetric
    next7Days: FinanceAmountMetric
    next15Days: FinanceAmountMetric
    next30Days: FinanceAmountMetric
    byCategory: FinanceCategoryMetric[]
  }
  receivables: {
    open: FinanceAmountMetric
    overdue: FinanceAmountMetric
    operationalOverdue365Days: FinanceAmountMetric
    legacyOverdue365Plus: FinanceAmountMetric
    receivedToday: FinanceAmountMetric
    expected7Days: FinanceAmountMetric
    expected15Days: FinanceAmountMetric
    expected30Days: FinanceAmountMetric
    aging: FinanceAgingBucket[]
  }
  dre: FinanceDreSummary
  indicators: {
    averageTicket: number | null
    fixedMonthlyCost: number
    breakEvenPoint: number | null
    profitabilityPercent: number | null
  }
  topDebtors: FinanceTopDebtor[]
  alerts: Array<{
    level: string
    title: string
    detail: string
    amount: number | null
  }>
  dataQualityNotes: string[]
  audit: FinanceDashboardAudit
}

export interface ReportAssistantResponse {
  company: string
  intent: string
  answer: string
  columns: string[]
  rows: Array<Record<string, string | number | null>>
  totalRows: number
  exportUrl: string | null
}
