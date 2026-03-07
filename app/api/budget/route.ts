import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetLines } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const year = searchParams.get('year')

  const rows = year
    ? await db.select().from(budgetLines).where(eq(budgetLines.year, parseInt(year)))
    : await db.select().from(budgetLines)

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
    return NextResponse.json({ error: 'Invalid budget payload.' }, { status: 400 })
  }

  await db.transaction(async (tx) => {
    for (const line of lines) {
      const existing = await tx
        .select({ id: budgetLines.id })
        .from(budgetLines)
        .where(and(
          eq(budgetLines.categoryId, line.categoryId),
          eq(budgetLines.year, year),
          eq(budgetLines.month, month)
        ))
        .limit(1)

      if (existing.length > 0) {
        await tx.update(budgetLines)
          .set({ amount: line.amount, notes: line.notes ?? null })
          .where(and(
            eq(budgetLines.categoryId, line.categoryId),
            eq(budgetLines.year, year),
            eq(budgetLines.month, month)
          ))
      } else {
        await tx.insert(budgetLines).values({
          id: uuidv4(),
          categoryId: line.categoryId,
          year,
          month,
          amount: line.amount,
          notes: line.notes ?? null,
        })
      }
    }
  })

  const saved = await db.select().from(budgetLines).where(
    and(eq(budgetLines.year, year), eq(budgetLines.month, month))
  )

  return NextResponse.json({ budgetLines: saved })
}
