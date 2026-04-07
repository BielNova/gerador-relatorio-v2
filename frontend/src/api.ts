import type {
  CompanyOverviewResponse,
  CompanyOption,
  FiscalDashboardResponse,
  NcmTaxRateResponse,
  ProductsFinishedResponse,
  ReportAssistantResponse,
} from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)
  if (!response.ok) {
    let message = 'Não foi possível carregar os dados.'
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        message = payload.detail
      }
    } catch {
      // noop
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export function fetchCompanies(): Promise<CompanyOption[]> {
  return readJson<CompanyOption[]>('/api/companies')
}

export function fetchCompanyOverview(company: string): Promise<CompanyOverviewResponse> {
  return readJson<CompanyOverviewResponse>(
    `/api/dashboard/overview?company=${encodeURIComponent(company)}`,
  )
}

export function fetchProductsFinished(company: string): Promise<ProductsFinishedResponse> {
  return readJson<ProductsFinishedResponse>(
    `/api/reports/products-finished?company=${encodeURIComponent(company)}`,
  )
}

export function fetchFiscalDashboard(company: string): Promise<FiscalDashboardResponse> {
  return readJson<FiscalDashboardResponse>(
    `/api/dashboard/fiscal?company=${encodeURIComponent(company)}`,
  )
}

export function fetchNcmTaxRates(company: string): Promise<NcmTaxRateResponse> {
  return readJson<NcmTaxRateResponse>(
    `/api/reports/ncm-tax-rates?company=${encodeURIComponent(company)}`,
  )
}

export function buildProductsFinishedExportUrl(
  company: string,
  filters: {
    search: string
    group: string
    onlyMissingNcm: boolean
  },
): string {
  return buildApiUrl('/api/reports/products-finished/export.xlsx', {
    company,
    search: filters.search,
    group: filters.group,
    onlyMissingNcm: String(filters.onlyMissingNcm),
  })
}

export function buildNcmTaxRatesExportUrl(
  company: string,
  filters: {
    search: string
    onlyVariation: boolean
  },
): string {
  return buildApiUrl('/api/reports/ncm-tax-rates/export.xlsx', {
    company,
    search: filters.search,
    onlyVariation: String(filters.onlyVariation),
  })
}

export async function askReportAssistant(
  company: string,
  question: string,
): Promise<ReportAssistantResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/report-assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ company, question }),
  })
  if (!response.ok) {
    let message = 'Não foi possível gerar o relatório com IA.'
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        message = payload.detail
      }
    } catch {
      // noop
    }
    throw new Error(message)
  }
  return (await response.json()) as ReportAssistantResponse
}

export function toApiHref(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${API_BASE_URL}${path}`
}

function buildApiUrl(path: string, params: Record<string, string>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value)
    }
  }
  return `${API_BASE_URL}${path}?${searchParams.toString()}`
}
