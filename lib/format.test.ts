import { afterEach, describe, expect, it } from 'vitest'
import { configureFormatting, formatDate, formatMonthYear, monthLabel, parseDateParts, todayISODate } from './format'

afterEach(() => configureFormatting({ locale: 'en-US', currency: 'USD', timezone: 'UTC' }))

describe('formatDate', () => {
  it('never shifts wall-clock dates across timezones', () => {
    configureFormatting({ locale: 'es-ES', timezone: 'America/Los_Angeles' })
    expect(formatDate('2025-01-15')).toBe('15/01/2025')
    expect(formatDate('2025-01-15 23:59:59')).toBe('15/01/2025')
    configureFormatting({ timezone: 'Pacific/Auckland' })
    expect(formatDate('2025-01-15 00:00:01')).toBe('15/01/2025')
  })

  it('shows real instants in the household timezone', () => {
    configureFormatting({ locale: 'es-ES', timezone: 'Europe/Madrid' })
    expect(formatDate('2025-01-15T23:30:00Z')).toBe('16/01/2025')
  })

  it('returns unparseable input unchanged', () => {
    expect(formatDate('not a date')).toBe('not a date')
  })
})

describe('month labels', () => {
  it('are independent of the configured timezone', () => {
    configureFormatting({ locale: 'es-ES', timezone: 'Pacific/Auckland' })
    expect(monthLabel(2025, 1)).toBe('ene')
    expect(formatMonthYear(2025, 1)).toBe('enero de 2025')
    configureFormatting({ timezone: 'America/Los_Angeles' })
    expect(monthLabel(2025, 1)).toBe('ene')
  })
})

describe('parseDateParts / todayISODate', () => {
  it('extracts calendar parts', () => {
    expect(parseDateParts('2025-12-31 10:00:00')).toEqual({ year: 2025, month: 12, day: 31 })
    expect(parseDateParts('31/12/2025')).toBeNull()
  })

  it('formats today as YYYY-MM-DD', () => {
    expect(todayISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
