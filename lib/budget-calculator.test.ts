import { describe, expect, it } from 'vitest'
import type { BudgetLine, Category, Transaction } from '@/db/schema'
import { computeMonthSummary } from './budget-calculator'

const FOOD: Category = { id: 'food', name: 'Food', color: '#000', icon: null, sortOrder: 1, isIncome: false, createdAt: '' }
const SALARY: Category = { id: 'salary', name: 'Salary', color: '#000', icon: null, sortOrder: 2, isIncome: true, createdAt: '' }
const CATS = [FOOD, SALARY]

let seq = 0
function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: `t${seq++}`, importBatchId: null, dedupHash: null, tipo: null, producto: null,
    fechaInicio: '2025-01-10 10:00:00', fechaFin: null, descripcion: 'x', importe: -10,
    comision: 0, divisa: 'EUR', state: 'COMPLETED', saldo: null, categoryId: 'food',
    categorySource: null, notes: null, isManual: false, excludeFromBudget: false,
    splitAnnual: false, budgetDate: null, createdAt: '', updatedAt: '',
    ...overrides,
  }
}

const line = (amount: number, month = 1): BudgetLine =>
  ({ id: `l${month}`, categoryId: 'food', year: 2025, month, amount, notes: null })

describe('computeMonthSummary', () => {
  it('counts completed charges in both export languages and ignores pending ones', () => {
    const s = computeMonthSummary(2025, 1, [line(100)], [
      tx({ importe: -10, state: 'COMPLETED' }),
      tx({ importe: -5, state: 'COMPLETADO' }),
      tx({ importe: -99, state: 'PENDING' }),
    ], CATS)
    expect(s.totals.actual).toBe(15)
    expect(s.lines[0]).toMatchObject({ actual: 15, variance: 85, status: 'ok' })
  })

  it('nets refunds in an expense category against its spending', () => {
    const s = computeMonthSummary(2025, 1, [line(100)], [
      tx({ importe: -80 }),
      tx({ importe: 30 }), // refund
    ], CATS)
    expect(s.totals.actual).toBe(50)
    expect(s.lines[0].actual).toBe(50)
    expect(s.income).toHaveLength(0)
  })

  it('treats income-category and uncategorized credits as income', () => {
    const s = computeMonthSummary(2025, 1, [line(100)], [
      tx({ importe: 2000, categoryId: 'salary' }),
      tx({ importe: 15, categoryId: null }),
      tx({ importe: 500, categoryId: 'salary', excludeFromBudget: true }),
      tx({ importe: 100, categoryId: 'salary', state: 'PENDING' }),
    ], CATS)
    expect(s.income.map(t => t.importe)).toEqual([2000, 15])
    expect(s.totals.actual).toBe(0)
  })

  it('only counts transactions whose effective month is this month', () => {
    const s = computeMonthSummary(2025, 1, [line(100)], [
      tx({ importe: -10 }),
      tx({ importe: -20, fechaInicio: '2024-12-31 23:00:00' }),
      tx({ importe: -40, fechaInicio: '2024-12-15 10:00:00', budgetDate: '2025-01-01' }),
      tx({ importe: -70, budgetDate: '2025-02-01' }),
    ], CATS)
    expect(s.totals.actual).toBe(50)
  })

  it('spreads annual expenses over the following 12 months', () => {
    const annual = tx({ importe: -1200, splitAnnual: true, fechaInicio: '2024-03-01 10:00:00' })
    const jan = computeMonthSummary(2025, 1, [line(100)], [annual], CATS)
    const feb = computeMonthSummary(2025, 2, [line(100, 2)], [annual], CATS)
    const mar = computeMonthSummary(2025, 3, [], [annual], CATS)
    expect(jan.totals.actual).toBe(100)
    expect(feb.totals.actual).toBe(100)
    expect(mar.totals.actual).toBe(0)
    expect(jan.lines[0].actualRaw).toBe(1200)
  })

  it('ignores budget lines for other months and income categories', () => {
    const s = computeMonthSummary(2025, 1, [
      line(100),
      line(999, 2),
      { id: 'inc', categoryId: 'salary', year: 2025, month: 1, amount: 5000, notes: null },
    ], [], CATS)
    expect(s.totals.budgeted).toBe(100)
  })

  it('splits totals per household member', () => {
    const s = computeMonthSummary(2025, 1, [line(100)], [tx({ importe: -30 })], CATS, 3)
    expect(s.perPerson).toEqual({ budgeted: 33.33, actual: 10 })
  })
})
