import { NextRequest, NextResponse } from 'next/server'
import { db, sqlite } from '@/db'
import { budgetLines } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const year = searchParams.get('year')

  const rows = year
    ? await db.query.budgetLines.findMany({
        where: (bl, { eq }) => eq(bl.year, parseInt(year)),
        with: { /* categoryId resolved client-side */ },
      })
    : await db.select().from(budgetLines).all()

  return NextResponse.json({ budgetLines: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { year, month, lines } = body as {
    year: number
    month: number
    lines: Array<{ categoryId: string; amount: number; notes?: string }>
  }

  if (!year || !month || !Array.isArray(lines)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Upsert all lines for this month
  const upsert = sqlite.transaction(() => {
    for (const line of lines) {
      const existing = sqlite.prepare(
        'SELECT id FROM budget_lines WHERE category_id = ? AND year = ? AND month = ?'
      ).get(line.categoryId, year, month)

      if (existing) {
        sqlite.prepare(
          'UPDATE budget_lines SET amount = ?, notes = ? WHERE category_id = ? AND year = ? AND month = ?'
        ).run(line.amount, line.notes ?? null, line.categoryId, year, month)
      } else {
        sqlite.prepare(
          'INSERT INTO budget_lines (id, category_id, year, month, amount, notes) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuidv4(), line.categoryId, year, month, line.amount, line.notes ?? null)
      }
    }
  })

  upsert()

  // Use Drizzle for the response so column names are camelCased
  const saved = await db.select().from(budgetLines).where(
    and(eq(budgetLines.year, year), eq(budgetLines.month, month))
  )

  return NextResponse.json({ budgetLines: saved })
}
