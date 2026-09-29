import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { budgetLines } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { parseJsonBody, parseSearchParams, withApiErrors } from '@/lib/api'
import { budgetQuerySchema, budgetSaveSchema } from '@/lib/validation'

export const GET = withApiErrors(async (request: NextRequest) => {
  const { year } = parseSearchParams(request, budgetQuerySchema)

  const rows = year !== undefined
    ? await db.select().from(budgetLines).where(eq(budgetLines.year, year))
    : await db.select().from(budgetLines)

  return NextResponse.json({ budgetLines: rows })
})

export const POST = withApiErrors(async (request: NextRequest) => {
  const { year, month, lines } = await parseJsonBody(request, budgetSaveSchema)

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
        notes: line.notes,
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
})
