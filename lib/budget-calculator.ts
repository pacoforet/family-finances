import type { Transaction, BudgetLine, Category } from '@/db/schema'
import { isCompletedState } from '@/lib/transaction-states'

export type BudgetStatus = 'ok' | 'warning' | 'over'

export interface BudgetLineResult {
  categoryId:      string
  categoryName:    string
  color:           string
  icon:            string | null
  budgeted:        number
  actual:          number
  actualRaw:       number   // net sum without splitAnnual adjustment (for display)
  variance:        number   // budgeted - actual, positive = under budget
  pct:             number   // actual / budgeted × 100
  status:          BudgetStatus
  transactions:    Transaction[]
}

export interface MonthSummary {
  year:          number
  month:         number
  lines:         BudgetLineResult[]
  uncategorized: Transaction[]
  income:        Transaction[]
  totals: {
    budgeted: number
    actual:   number
    variance: number
    pct:      number
  }
  perPerson: {
    budgeted: number
    actual:   number
  }
  /** Cumulative spending at the end of each day of the month (index 0 = day 1) */
  cumulativeByDay: number[]
}

/** Month index (year * 12 + month - 1) of the date a transaction counts in. */
export function effectiveMonthIndex(t: Pick<Transaction, 'budgetDate' | 'fechaInicio'>): number {
  const date = String(t.budgetDate ?? t.fechaInicio)
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  return y * 12 + (m - 1)
}

/** Budget impact of a transaction: annual expenses are spread over 12 months. */
function budgetAmount(t: Transaction): number {
  return t.splitAnnual ? t.importe / 12 : t.importe
}

/**
 * Builds the budget-vs-actual summary for one month.
 *
 * `allTransactions` may contain transactions from other months: only those
 * whose effective month (budget_date, else fecha_inicio) is this month count,
 * plus annual (splitAnnual) transactions from the previous 11 months, which
 * contribute 1/12 of their amount.
 *
 * Spending is net per category: a refund (positive amount) in an expense
 * category reduces that category's spending instead of counting as income.
 */
export function computeMonthSummary(
  year: number,
  month: number,
  budgetLines: BudgetLine[],
  allTransactions: Transaction[],
  categories: Category[],
  householdSize = 1,
): MonthSummary {
  const monthIndex = year * 12 + (month - 1)
  const incomeCatIds = new Set(categories.filter(c => c.isIncome).map(c => c.id))

  const counts = (t: Transaction) => isCompletedState(t.state) && !t.excludeFromBudget
  const inMonth = (t: Transaction) => effectiveMonthIndex(t) === monthIndex
  const inBudgetWindow = (t: Transaction) => {
    if (!t.splitAnnual) return inMonth(t)
    const idx = effectiveMonthIndex(t)
    return idx <= monthIndex && idx > monthIndex - 12
  }

  const isExpenseCategory = (t: Transaction) => !!t.categoryId && !incomeCatIds.has(t.categoryId)

  // Spending: charges not in an income category, plus refunds in expense categories.
  const spending = allTransactions.filter(t =>
    counts(t) && inBudgetWindow(t) && !incomeCatIds.has(t.categoryId ?? '') &&
    (t.importe < 0 || (t.importe > 0 && isExpenseCategory(t)))
  )

  // Income: this month's income-category transactions and uncategorized credits.
  const income = allTransactions.filter(t =>
    counts(t) && inMonth(t) &&
    (incomeCatIds.has(t.categoryId ?? '') || (t.importe > 0 && !t.categoryId))
  )

  const catMap = new Map(categories.map(c => [c.id, c]))
  const expenseBudgetLines = budgetLines.filter(bl =>
    bl.year === year && bl.month === month && !incomeCatIds.has(bl.categoryId)
  )

  const lines: BudgetLineResult[] = expenseBudgetLines.map(bl => {
    const cat = catMap.get(bl.categoryId)
    const catTransactions = spending.filter(t => t.categoryId === bl.categoryId)

    // Spending is the negated net amount: charges are negative, refunds positive.
    const actual = -catTransactions.reduce((sum, t) => sum + budgetAmount(t), 0)
    const actualRaw = -catTransactions.reduce((sum, t) => sum + t.importe, 0)

    const pct = bl.amount > 0 ? (actual / bl.amount) * 100 : 0
    const status: BudgetStatus = pct > 100 ? 'over' : pct > 85 ? 'warning' : 'ok'

    return {
      categoryId:   bl.categoryId,
      categoryName: cat?.name ?? 'Desconocida',
      color:        cat?.color ?? '#9CA3AF',
      icon:         cat?.icon ?? null,
      budgeted:     bl.amount,
      actual:       round2(actual),
      actualRaw:    round2(actualRaw),
      variance:     round2(bl.amount - actual),
      pct:          round1(pct),
      status,
      transactions: catTransactions,
    }
  })

  // Sort lines by actual spending descending (highest first)
  lines.sort((a, b) => b.actual - a.actual)

  const uncategorized = spending.filter(t => !t.categoryId && inMonth(t))

  const totalBudgeted = lines.reduce((s, l) => s + l.budgeted, 0)
  const totalActual = -spending.reduce((sum, t) => sum + budgetAmount(t), 0)
  const totalPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0

  // Annual expenses spread from earlier months count from day 1
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cumulativeByDay = new Array<number>(daysInMonth).fill(0)
  for (const t of spending) {
    const day = inMonth(t) ? Number(String(t.budgetDate ?? t.fechaInicio).slice(8, 10)) || 1 : 1
    cumulativeByDay[Math.min(day, daysInMonth) - 1] -= budgetAmount(t)
  }
  for (let i = 1; i < daysInMonth; i++) cumulativeByDay[i] += cumulativeByDay[i - 1]

  return {
    year,
    month,
    lines,
    uncategorized,
    income,
    totals: {
      budgeted: round2(totalBudgeted),
      actual:   round2(totalActual),
      variance: round2(totalBudgeted - totalActual),
      pct:      round1(totalPct),
    },
    perPerson: {
      budgeted: round2(totalBudgeted / Math.max(householdSize, 1)),
      actual:   round2(totalActual / Math.max(householdSize, 1)),
    },
    cumulativeByDay: cumulativeByDay.map(round2),
  }
}

// `|| 0` turns -0 (from negating an empty sum) into 0
function round2(n: number) { return Math.round(n * 100) / 100 || 0 }
function round1(n: number) { return Math.round(n * 10) / 10 || 0 }
