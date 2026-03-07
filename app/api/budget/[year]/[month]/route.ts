import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetLines, transactions, categories } from '@/db/schema'
import { eq, and, gte, lt, sql } from 'drizzle-orm'
import { computeMonthSummary } from '@/lib/budget-calculator'
import { getPublicAppSettings } from '@/lib/app-settings'
import { v4 as uuidv4 } from 'uuid'
import type { BudgetLine } from '@/db/schema'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year: yearStr, month: monthStr } = await params
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month.' }, { status: 400 })
  }

  const lines = await db.select().from(budgetLines).where(
    and(eq(budgetLines.year, year), eq(budgetLines.month, month))
  )

  const startDate     = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`
  const nextMonthDate = month === 12
    ? `${year + 1}-01-01 00:00:00`
    : `${year}-${String(month + 1).padStart(2, '0')}-01 00:00:00`

  const monthTxs = await db.select().from(transactions).where(
    sql`COALESCE(budget_date, fecha_inicio) >= ${startDate} AND COALESCE(budget_date, fecha_inicio) < ${nextMonthDate}`
  )

  const startRaw  = month - 11
  const winMonth  = startRaw <= 0 ? startRaw + 12 : startRaw
  const winYear   = startRaw <= 0 ? year - 1      : year
  const windowStart = `${winYear}-${String(winMonth).padStart(2, '0')}-01 00:00:00`

  const annualTxs = await db.select().from(transactions).where(
    and(
      eq(transactions.splitAnnual, true),
      gte(transactions.fechaInicio, windowStart),
      lt(transactions.fechaInicio, nextMonthDate)
    )
  )

  const monthTxIds = new Set(monthTxs.map(t => t.id))
  const extraAnnualTxs = annualTxs.filter(t => !monthTxIds.has(t.id))
  const allTxs = [...monthTxs, ...extraAnnualTxs]

  const cats    = await db.select().from(categories)
  const settings = await getPublicAppSettings()
  const summary = computeMonthSummary(year, month, lines, allTxs, cats, settings.householdSize)

  return NextResponse.json({ summary })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year: yearStr, month: monthStr } = await params
  const targetYear  = parseInt(yearStr)
  const targetMonth = parseInt(monthStr)

  const body = await request.json()
  const { fromYear, fromMonth } = body

  const sourceLines = await db.select().from(budgetLines).where(
    and(eq(budgetLines.year, fromYear), eq(budgetLines.month, fromMonth))
  ) as BudgetLine[]

  if (!sourceLines.length) {
    return NextResponse.json({ error: 'No budget exists for the source month.' }, { status: 404 })
  }

  await db.transaction(async (tx) => {
    for (const line of sourceLines) {
      const existing = await tx
        .select({ id: budgetLines.id })
        .from(budgetLines)
        .where(and(
          eq(budgetLines.categoryId, line.categoryId),
          eq(budgetLines.year, targetYear),
          eq(budgetLines.month, targetMonth)
        ))
        .limit(1)

      if (existing.length > 0) {
        await tx.update(budgetLines)
          .set({ amount: line.amount, notes: line.notes })
          .where(and(
            eq(budgetLines.categoryId, line.categoryId),
            eq(budgetLines.year, targetYear),
            eq(budgetLines.month, targetMonth)
          ))
      } else {
        await tx.insert(budgetLines).values({
          id: uuidv4(),
          categoryId: line.categoryId,
          year: targetYear,
          month: targetMonth,
          amount: line.amount,
          notes: line.notes,
        })
      }
    }
  })

  const saved = await db.select().from(budgetLines).where(
    and(eq(budgetLines.year, targetYear), eq(budgetLines.month, targetMonth))
  )

  return NextResponse.json({ budgetLines: saved })
}
