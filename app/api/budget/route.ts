import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetLines } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { invalidJsonResponse, isValidYearMonth, readJsonBody } from '@/lib/api'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const year = searchParams.get('year')

  const rows = year
    ? await db.select().from(budgetLines).where(eq(budgetLines.year, parseInt(year)))
    : await db.select().from(budgetLines)

  return NextResponse.json({ budgetLines: rows })
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request)
  if (!body) return invalidJsonResponse()

  const { year, month, lines } = body as {
    year: number
    month: number
    lines: Array<{ categoryId: string; amount: number; notes?: string }>
  }

  if (!isValidYearMonth(year, month) || !Array.isArray(lines)) {
    return NextResponse.json({ error: 'Invalid budget payload.' }, { status: 400 })
  }

  const invalidLine = lines.some(line =>
    !line || typeof line.categoryId !== 'string' || !line.categoryId || !Number.isFinite(line.amount)
  )
  if (invalidLine) {
    return NextResponse.json({ error: 'Each budget line needs a category and a numeric amount.' }, { status: 400 })
  }

  // ON CONFLICT cannot touch the same row twice in one statement: last line wins.
  const uniqueLines = [...new Map(lines.map(line => [line.categoryId, line])).values()]

  if (uniqueLines.length > 0) {
    await db.insert(budgetLines)
      .values(uniqueLines.map(line => ({
        id: uuidv4(),
        categoryId: line.categoryId,
        year,
        month,
        amount: line.amount,
        notes: line.notes ?? null,
      })))
      .onConflictDoUpdate({
        target: [budgetLines.categoryId, budgetLines.year, budgetLines.month],
        set: { amount: sql`excluded.amount`, notes: sql`excluded.notes` },
      })
  }

  const saved = await db.select().from(budgetLines).where(
    and(eq(budgetLines.year, year), eq(budgetLines.month, month))
  )

  return NextResponse.json({ budgetLines: saved })
}
