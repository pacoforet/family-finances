type FormattingConfig = {
  locale: string
  currency: string
  timezone: string
}

let currentConfig: FormattingConfig = {
  locale: 'en-US',
  currency: 'USD',
  timezone: 'UTC',
}

export function configureFormatting(config: Partial<FormattingConfig>) {
  currentConfig = {
    ...currentConfig,
    ...config,
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(currentConfig.locale, {
    style: 'currency',
    currency: currentConfig.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return new Intl.DateTimeFormat(currentConfig.locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: currentConfig.timezone,
  }).format(date)
}

export function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat(currentConfig.locale, {
    month: 'long',
    year: 'numeric',
    timeZone: currentConfig.timezone,
  }).format(date)
}

export function monthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat(currentConfig.locale, {
    month: 'short',
    timeZone: currentConfig.timezone,
  }).format(date)
}

export function monthName(month: number, year = 2024): string {
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat(currentConfig.locale, {
    month: 'long',
    timeZone: currentConfig.timezone,
  }).format(date)
}

// e.g. "2025-01"
export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function fromMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-')
  return { year: parseInt(y), month: parseInt(m) }
}
