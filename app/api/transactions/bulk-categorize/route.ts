import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

/**
 * POST /api/transactions/bulk-categorize
 * Assigns a category to all uncategorized transactions with the same description.
 * Body: { description: string, categoryId: string }
 * Returns: { updated: number }
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { description, categoryId } = body

  if (!description || !categoryId) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const result = await db
    .update(transactions)
    .set({
      categoryId,
      categorySource: 'manual',
      updatedAt: now,
    })
    .where(
      and(
        eq(transactions.descripcion, description),
        isNull(transactions.categoryId)
      )
    )
    .returning({ id: transactions.id })

  return NextResponse.json({ updated: result.length })
}
