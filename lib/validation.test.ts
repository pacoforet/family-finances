import { describe, expect, it } from 'vitest'
import {
  appSettingsSchema, budgetSaveSchema, mappingRuleCreateSchema,
  transactionCreateSchema, transactionUpdateSchema, transactionsQuerySchema,
} from './validation'

describe('validation schemas', () => {
  it('accepts numeric strings for amounts and rejects garbage', () => {
    expect(transactionCreateSchema.parse({ descripcion: 'x', importe: '-12.5', fechaInicio: '2025-01-02' }).importe).toBe(-12.5)
    expect(transactionCreateSchema.safeParse({ descripcion: 'x', importe: 'abc', fechaInicio: '2025-01-02' }).success).toBe(false)
    expect(transactionCreateSchema.safeParse({ descripcion: 'x', importe: '', fechaInicio: '2025-01-02' }).success).toBe(false)
  })

  it('normalizes dates', () => {
    expect(transactionCreateSchema.parse({ descripcion: 'x', importe: 1, fechaInicio: '2025-01-02T12:00' }).fechaInicio).toBe('2025-01-02 12:00')
    expect(transactionUpdateSchema.parse({ budgetDate: '2025-02-01 00:00:00' }).budgetDate).toBe('2025-02-01')
    expect(transactionUpdateSchema.parse({ budgetDate: null }).budgetDate).toBeNull()
    expect(transactionCreateSchema.safeParse({ descripcion: 'x', importe: 1, fechaInicio: '02/01/2025' }).success).toBe(false)
  })

  it('validates budget payloads', () => {
    expect(budgetSaveSchema.safeParse({ year: 2025, month: 13, lines: [] }).success).toBe(false)
    expect(budgetSaveSchema.safeParse({ year: 2025, month: 1, lines: [{ categoryId: 'c', amount: 'x' }] }).success).toBe(false)
    expect(budgetSaveSchema.parse({ year: 2025, month: 1, lines: [{ categoryId: 'c', amount: 10 }] }).lines[0].notes).toBeNull()
  })

  it('rejects invalid regex rules', () => {
    expect(mappingRuleCreateSchema.safeParse({ categoryId: 'c', matchType: 'regex', matchValue: '([' }).success).toBe(false)
    expect(mappingRuleCreateSchema.parse({ categoryId: 'c', matchType: 'contains', matchValue: 'x' }).priority).toBe(100)
  })

  it('validates settings values against Intl', () => {
    const base = { appName: 'A', householdName: 'H', defaultCurrency: 'eur', locale: 'es-ES', timezone: 'Europe/Madrid', householdSize: 2 }
    expect(appSettingsSchema.parse(base).defaultCurrency).toBe('EUR')
    expect(appSettingsSchema.safeParse({ ...base, timezone: 'Mars/Base' }).success).toBe(false)
    expect(appSettingsSchema.safeParse({ ...base, defaultCurrency: 'EURO' }).success).toBe(false)
  })

  it('applies query defaults', () => {
    expect(transactionsQuerySchema.parse({})).toEqual({ uncategorized: false, page: 1, limit: 50 })
    expect(transactionsQuerySchema.safeParse({ month: '2025-1' }).success).toBe(false)
  })
})
