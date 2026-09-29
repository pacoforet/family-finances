import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { parseJsonBody, withApiErrors } from '@/lib/api'
import { bulkCategorizeSchema } from '@/lib/validation'

/**
 * POST /api/transactions/bulk-categorize
 * Assigns a category to all uncategorized transactions with the same description.
 * Body: { description: string, categoryId: string }
 * Returns: { updated: number }
 */
export const POST = withApiErrors(async (request: NextRequest) => {
  const { description, categoryId } = await parseJsonBody(request, bulkCategorizeSchema)

  const result = await db
    .update(transactions)
    .set({
      categoryId,
      categorySource: 'manual',
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(transactions.descripcion, description), isNull(transactions.categoryId)))
    .returning({ id: transactions.id })

  return NextResponse.json({ updated: result.length })
})
