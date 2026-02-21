import { NextRequest, NextResponse } from 'next/server'
import { db, sqlite } from '@/db'
import { budgetLines, transactions, categories } from '@/db/schema'
import { eq, and, gte, lt, sql } from 'drizzle-orm'
import { computeMonthSummary } from '@/lib/budget-calculator'
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
    return NextResponse.json({ error: 'Año o mes inválido' }, { status: 400 })
  }

  const lines = await db.select().from(budgetLines).where(
    and(eq(budgetLines.year, year), eq(budgetLines.month, month))
  )

  // ── Transactions for this month ────────────────────────────────────────────
  const startDate     = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`
  const nextMonthDate = month === 12
    ? `${year + 1}-01-01 00:00:00`
    : `${year}-${String(month + 1).padStart(2, '0')}-01 00:00:00`

  // Use COALESCE so that a manually-set budgetDate overrides the real transaction date
  const monthTxs = await db.select().from(transactions).where(
    sql`COALESCE(budget_date, fecha_inicio) >= ${startDate} AND COALESCE(budget_date, fecha_inicio) < ${nextMonthDate}`
  )

  // ── Also fetch splitAnnual transactions within the trailing 12-month window ─
  // A splitAnnual tx paid in month P contributes 1/12 to months P, P+1, …, P+11.
  // Equivalently, month M should include splitAnnual txs paid between (M-11) and M.
  const startRaw  = month - 11            // may be ≤ 0
  const winMonth  = startRaw <= 0 ? startRaw + 12 : startRaw
  const winYear   = startRaw <= 0 ? year - 1      : year
  const windowStart = `${winYear}-${String(winMonth).padStart(2, '0')}-01 00:00:00`
  // windowEnd = first day of (month+1) = nextMonthDate (already computed above)

  const annualTxs = await db.select().from(transactions).where(
    and(
      eq(transactions.splitAnnual, true),
      gte(transactions.fechaInicio, windowStart),
      lt(transactions.fechaInicio, nextMonthDate)
    )
  )

  // Merge: month transactions + splitAnnual from OTHER months (avoid duplicates)
  const monthTxIds = new Set(monthTxs.map(t => t.id))
  const extraAnnualTxs = annualTxs.filter(t => !monthTxIds.has(t.id))
  const allTxs = [...monthTxs, ...extraAnnualTxs]

  const cats    = await db.select().from(categories)
  const summary = computeMonthSummary(year, month, lines, allTxs, cats)

  return NextResponse.json({ summary })
}

// Clone budget FROM a source month INTO this month
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
    return NextResponse.json({ error: 'No hay presupuesto en el mes origen' }, { status: 404 })
  }

  const clone = sqlite.transaction(() => {
    for (const line of sourceLines) {
      const existing = sqlite.prepare(
        'SELECT id FROM budget_lines WHERE category_id = ? AND year = ? AND month = ?'
      ).get(line.categoryId, targetYear, targetMonth)

      if (existing) {
        sqlite.prepare(
          'UPDATE budget_lines SET amount = ?, notes = ? WHERE category_id = ? AND year = ? AND month = ?'
        ).run(line.amount, line.notes, line.categoryId, targetYear, targetMonth)
      } else {
        sqlite.prepare(
          'INSERT INTO budget_lines (id, category_id, year, month, amount, notes) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuidv4(), line.categoryId, targetYear, targetMonth, line.amount, line.notes)
      }
    }
  })
  clone()

  const saved = await db.select().from(budgetLines).where(
    and(eq(budgetLines.year, targetYear), eq(budgetLines.month, targetMonth))
  )

  return NextResponse.json({ budgetLines: saved })
}
