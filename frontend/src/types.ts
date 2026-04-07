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

export interface ReportAssistantResponse {
  company: string
  intent: string
  answer: string
  columns: string[]
  rows: Array<Record<string, string | number | null>>
  totalRows: number
  exportUrl: string | null
}
