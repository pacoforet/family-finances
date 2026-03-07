import type { Transaction, BudgetLine, Category } from '@/db/schema'

export type BudgetStatus = 'ok' | 'warning' | 'over'

export interface BudgetLineResult {
  categoryId:      string
  categoryName:    string
  color:           string
  icon:            string | null
  budgeted:        number
  actual:          number
  actualRaw:       number   // sum without splitAnnual adjustment (for display)
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
}

export function computeMonthSummary(
  year: number,
  month: number,
  budgetLines: BudgetLine[],
  allTransactions: Transaction[],
  categories: Category[],
  householdSize = 1,
): MonthSummary {
  // Income categories are never counted as expenses
  const incomeCatIds = new Set(categories.filter(c => c.isIncome).map(c => c.id))

  // Expenses: negative importe, completed, not excluded, not an income category
  const expenses = allTransactions.filter(
    t => t.importe < 0 && t.state === 'COMPLETADO' && !t.excludeFromBudget && !incomeCatIds.has(t.categoryId ?? '')
  )

  // Income: positive importe (also include transactions in income categories)
  const income = allTransactions.filter(t => t.importe > 0 || incomeCatIds.has(t.categoryId ?? ''))

  const catMap = new Map(categories.map(c => [c.id, c]))

  // Only include budget lines for expense categories (not income)
  const expenseBudgetLines = budgetLines.filter(bl => !incomeCatIds.has(bl.categoryId))

  const lines: BudgetLineResult[] = expenseBudgetLines.map(bl => {
    const cat = catMap.get(bl.categoryId)
    const catTransactions = expenses.filter(t => t.categoryId === bl.categoryId)

    // For budget purposes: split annual expenses across 12 months (÷12)
    const actual = catTransactions.reduce((sum, t) => {
      const amount = Math.abs(t.importe)
      return sum + (t.splitAnnual ? amount / 12 : amount)
    }, 0)

    // Raw actual (full amounts, for informational display)
    const actualRaw = catTransactions.reduce((sum, t) => sum + Math.abs(t.importe), 0)

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

  const uncategorized = expenses.filter(t => !t.categoryId)

  const totalBudgeted = lines.reduce((s, l) => s + l.budgeted, 0)
  const totalActual = expenses.reduce((sum, t) => {
    const amount = Math.abs(t.importe)
    return sum + (t.splitAnnual ? amount / 12 : amount)
  }, 0)
  const totalPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0

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
  }
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10) / 10 }
