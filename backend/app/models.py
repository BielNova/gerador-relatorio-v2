from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel


class CompanyOption(BaseModel):
    id: str
    label: str
    hasData: bool


class BusinessAreaTableMetric(BaseModel):
    name: str
    rows: int


class BusinessAreaSummary(BaseModel):
    id: str
    label: str
    description: str
    tableCount: int
    totalRows: int
    hasData: bool
    entryPath: str | None
    tables: list[BusinessAreaTableMetric]


class CompanyOverviewSummary(BaseModel):
    areaCount: int
    activeAreaCount: int
    totalRows: int


class CompanyOverviewResponse(BaseModel):
    company: str
    summary: CompanyOverviewSummary
    areas: list[BusinessAreaSummary]


class ProductsFinishedRow(BaseModel):
    code: str
    description: str
    group: str | None
    ncm: str | None
    icmsRate: float | None
    ipiRate: float | None
    pisRate: float | None
    cofinsRate: float | None


class ProductsFinishedSummary(BaseModel):
    totalRows: int
    missingNcmRows: int
    groupCount: int


class ProductsFinishedResponse(BaseModel):
    company: str
    summary: ProductsFinishedSummary
    rows: list[ProductsFinishedRow]


class NcmTaxRateRow(BaseModel):
    ncm: str
    icmsRate: float | None
    ipiRate: float | None
    pisRate: float | None
    cofinsRate: float | None


class NcmTaxRateSummary(BaseModel):
    totalRows: int
    distinctNcms: int
    duplicateNcmRows: int


class NcmTaxRateResponse(BaseModel):
    company: str
    summary: NcmTaxRateSummary
    rows: list[NcmTaxRateRow]


class FiscalDashboardSummary(BaseModel):
    totalProducts: int
    missingNcmProducts: int
    distinctNcms: int
    ncmVariationCount: int
    duplicateNcmRows: int
    productsWithAnyZeroRate: int
    zeroIcmsProducts: int
    zeroIpiProducts: int
    zeroPisProducts: int
    zeroCofinsProducts: int


class FiscalDashboardGroupIssue(BaseModel):
    group: str
    totalRows: int
    missingNcmRows: int
    zeroRateRows: int
    issueRows: int


class FiscalDashboardResponse(BaseModel):
    company: str
    summary: FiscalDashboardSummary
    groupIssues: list[FiscalDashboardGroupIssue]


class FinanceReceivableFilters(BaseModel):
    search: str
    onlyOverdue: bool
    dueEnd: date


class FinanceReceivableSummary(BaseModel):
    totalOpenRows: int
    totalOpenAmount: float
    overdueRows: int
    overdueAmount: float
    dueNextRows: int
    dueNextAmount: float
    receivedMonthRows: int
    receivedMonthAmount: float
    filteredRows: int
    filteredAmount: float


class FinanceTopDebtor(BaseModel):
    personCode: str
    personName: str
    overdueRows: int
    overdueAmount: float


class FinanceReceivableRow(BaseModel):
    boletoCode: str
    titleCode: str | None
    contract: str | None
    installment: str | None
    personCode: str
    personName: str
    paymentMethod: str | None
    dueDate: date | None
    amount: float
    daysOverdue: int
    bankDocument: str | None
    statusCode: int
    statusLabel: str


class FinanceReceivablesResponse(BaseModel):
    company: str
    filters: FinanceReceivableFilters
    summary: FinanceReceivableSummary
    topDebtors: list[FinanceTopDebtor]
    rows: list[FinanceReceivableRow]


class FinanceAmountMetric(BaseModel):
    rows: int
    amount: float


class FinanceAgingBucket(BaseModel):
    label: str
    rows: int
    amount: float
    minDaysOverdue: int | None
    maxDaysOverdue: int | None


class FinanceAuditMetric(BaseModel):
    rows: int
    amount: float
    startDate: date | None
    endDate: date | None


class FinanceCashAudit(BaseModel):
    source: str
    rule: str
    accountRows: int
    movementRows: int
    startDate: date | None
    endDate: date | None
    amount: float


class FinancePayablesAudit(BaseModel):
    rawOpen: FinanceAuditMetric
    operational30Days: FinanceAuditMetric
    currentYearOpen: FinanceAuditMetric
    futureOutOfHorizon: FinanceAuditMetric
    missingDueDate: FinanceAuditMetric
    futureAnomalies2030Plus: FinanceAuditMetric


class FinanceReceivablesAudit(BaseModel):
    rawOpen: FinanceAuditMetric
    overdueTotal: FinanceAuditMetric
    overdueOperational365Days: FinanceAuditMetric
    overdueLegacy365Plus: FinanceAuditMetric
    expected30Days: FinanceAuditMetric


class FinanceDreAudit(BaseModel):
    dreReferenceMonth: str | None
    dreRevenueTotal: float
    latestInvoiceMonthFromCVFATURA: str | None
    latestInvoiceRevenueTotal: float
    isFallbackMonth: bool
    isStaleComparedToInvoices: bool


class FinanceExternalComparison(BaseModel):
    referenceUrl: str
    runtimeDependency: bool
    note: str


class FinanceDashboardAudit(BaseModel):
    referenceDate: date
    cash: FinanceCashAudit
    payables: FinancePayablesAudit
    receivables: FinanceReceivablesAudit
    dre: FinanceDreAudit
    externalComparison: FinanceExternalComparison


class FinanceCashSummary(BaseModel):
    sourceDate: date | None
    currentCash: float
    consolidatedBalance: float
    availableCash: float
    committedCash: float


class FinanceFlowMetric(BaseModel):
    label: str
    startDate: date
    endDate: date
    inflow: float
    outflow: float
    net: float


class FinanceDashboardPeriod(BaseModel):
    mode: str
    label: str
    startDate: date
    endDate: date
    cashFlow: FinanceFlowMetric
    payablesDue: FinanceAmountMetric
    receivablesDue: FinanceAmountMetric
    received: FinanceAmountMetric


class FinanceProjectionPoint(BaseModel):
    days: int
    date: date
    projectedBalance: float
    expectedReceivables: float
    expectedPayables: float
    projectedResult: float


class FinanceCategoryMetric(BaseModel):
    category: str
    amount: float
    sharePercent: float


class FinanceDreEvolutionPoint(BaseModel):
    year: int
    month: int
    revenue: float
    expenses: float
    netProfit: float


class FinanceDreSummary(BaseModel):
    year: int
    month: int
    isFallbackMonth: bool
    revenueTotal: float
    costs: float
    expenses: float
    grossProfit: float
    netProfit: float
    revenuePreviousMonth: float
    expensesPreviousMonth: float
    revenueChangePercent: float | None
    expensesChangePercent: float | None
    expenseCategories: list[FinanceCategoryMetric]
    revenueCategories: list[FinanceCategoryMetric]
    revenueEvolution: list[FinanceDreEvolutionPoint]


class FinancePayablesSummary(BaseModel):
    open: FinanceAmountMetric
    overdue: FinanceAmountMetric
    dueToday: FinanceAmountMetric
    next7Days: FinanceAmountMetric
    next15Days: FinanceAmountMetric
    next30Days: FinanceAmountMetric
    byCategory: list[FinanceCategoryMetric]


class FinanceReceivablesDashboardSummary(BaseModel):
    open: FinanceAmountMetric
    overdue: FinanceAmountMetric
    operationalOverdue365Days: FinanceAmountMetric
    legacyOverdue365Plus: FinanceAmountMetric
    receivedToday: FinanceAmountMetric
    expected7Days: FinanceAmountMetric
    expected15Days: FinanceAmountMetric
    expected30Days: FinanceAmountMetric
    aging: list[FinanceAgingBucket]


class FinanceIndicatorsSummary(BaseModel):
    averageTicket: float | None
    fixedMonthlyCost: float
    breakEvenPoint: float | None
    profitabilityPercent: float | None


class FinanceAlert(BaseModel):
    level: str
    title: str
    detail: str
    amount: float | None = None


class FinanceDashboardResponse(BaseModel):
    company: str
    referenceDate: date
    period: FinanceDashboardPeriod
    cash: FinanceCashSummary
    cashFlow: list[FinanceFlowMetric]
    projections: list[FinanceProjectionPoint]
    payables: FinancePayablesSummary
    receivables: FinanceReceivablesDashboardSummary
    dre: FinanceDreSummary
    indicators: FinanceIndicatorsSummary
    topDebtors: list[FinanceTopDebtor]
    alerts: list[FinanceAlert]
    dataQualityNotes: list[str]
    audit: FinanceDashboardAudit


class ReportAssistantRequest(BaseModel):
    company: str
    question: str


class ReportAssistantResponse(BaseModel):
    company: str
    intent: str
    answer: str
    columns: list[str]
    rows: list[dict[str, Any]]
    totalRows: int
    exportUrl: str | None
