const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const integerFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
})

export function formatRate(value: number | null): string {
  if (value == null) {
    return '-'
  }
  return `${percentFormatter.format(value)}%`
}

export function formatInteger(value: number | null | undefined): string {
  return integerFormatter.format(value ?? 0)
}

export function formatDecimal(value: number | null | undefined): string {
  return decimalFormatter.format(value ?? 0)
}

export function formatCurrency(value: number | null | undefined): string {
  return currencyFormatter.format(value ?? 0)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`))
}

export function normalizeSearchTerm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
