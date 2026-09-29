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

/**
 * Sets the locale, currency and timezone used by the helpers below.
 * AppSettingsProvider calls this while rendering, before any child renders, so
 * server-rendered HTML and the first client render already use the household
 * settings. One deployment serves one household, so the shared module state is
 * the same for every request.
 */
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

// "2025-01-15" or "2025-01-15 10:23:11" — a wall-clock date with no timezone.
const WALL_CLOCK_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/

/** Extracts year/month/day from a wall-clock date string, without timezone math. */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const match = WALL_CLOCK_DATE.exec(dateStr.trim())
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''

  // Bank exports and manual entries store the local calendar date. Parsing them
  // with `new Date()` would treat them as UTC or browser-local instants and
  // shift the day when converted to another timezone, so format them as-is.
  const parts = parseDateParts(dateStr)
  if (parts) {
    return new Intl.DateTimeFormat(currentConfig.locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
  }

  // Real instants (e.g. ISO timestamps with a zone) are shown in the household timezone.
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return new Intl.DateTimeFormat(currentConfig.locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: currentConfig.timezone,
  }).format(date)
}

// Month labels describe calendar months, not instants: build them in UTC and
// format them in UTC so the browser's timezone can never shift the month.
function calendarMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1))
}

export function formatMonthYear(year: number, month: number): string {
  return new Intl.DateTimeFormat(currentConfig.locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(calendarMonth(year, month))
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat(currentConfig.locale, {
    month: 'short',
    timeZone: 'UTC',
  }).format(calendarMonth(year, month))
}

export function monthName(month: number, year = 2024): string {
  return new Intl.DateTimeFormat(currentConfig.locale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(calendarMonth(year, month))
}

/** Today's calendar date ("YYYY-MM-DD") in the household timezone. */
export function todayISODate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: currentConfig.timezone,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// e.g. "2025-01"
export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function fromMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-')
  return { year: parseInt(y), month: parseInt(m) }
}
