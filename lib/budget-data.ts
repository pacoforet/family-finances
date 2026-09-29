import { and, gte, lt, or, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { budgetLines, categories, transactions } from '@/db/schema'
import { computeMonthSummary, type MonthSummary } from '@/lib/budget-calculator'
import { getPublicAppSettings } from '@/lib/app-settings'

/**
 * First day of a month as "YYYY-MM-01". Date-only bounds compare correctly
 * both against date/timestamp columns and against legacy text values, where
 * "2025-02-01" < "2025-02-01 00:00:00" would otherwise drop day-only dates.
 */
export function monthStart(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Date a transaction counts in: the manual budget month, else its own date. */
export const effectiveDate = sql`COALESCE(${transactions.budgetDate}, ${transactions.fechaInicio})`

/**
 * Computes the summaries for a range of consecutive months with four queries,
 * loading this range's transactions plus the annual (splitAnnual) ones from
 * the 11 months before it, which still count 1/12 per month.
 */
export async function getMonthSummaries(
  fromYear: number,
  fromMonth: number,
  monthCount: number,
): Promise<MonthSummary[]> {
  const first = fromYear * 12 + (fromMonth - 1)
  const end = first + monthCount // exclusive

  const [lines, txs, cats, settings] = await Promise.all([
    db.select().from(budgetLines).where(and(
      sql`${budgetLines.year} * 12 + ${budgetLines.month} - 1 >= ${first}`,
      sql`${budgetLines.year} * 12 + ${budgetLines.month} - 1 < ${end}`,
    )),
    db.select().from(transactions).where(or(
      and(gte(effectiveDate, monthStart(first)), lt(effectiveDate, monthStart(end))),
      and(
        eq(transactions.splitAnnual, true),
        gte(effectiveDate, monthStart(first - 11)),
        lt(effectiveDate, monthStart(end)),
      ),
    )),
    db.select().from(categories),
    getPublicAppSettings(),
  ])

  return Array.from({ length: monthCount }, (_, i) => {
    const idx = first + i
    return computeMonthSummary(
      Math.floor(idx / 12), (idx % 12) + 1, lines, txs, cats, settings.householdSize,
    )
  })
}
