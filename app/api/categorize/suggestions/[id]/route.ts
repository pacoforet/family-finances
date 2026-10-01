import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { transactions } from '@/db/schema'
import { HttpError, parseJsonBody, withApiErrors } from '@/lib/api'
import { clearedSuggestion } from '@/lib/auto-categorize'

const bodySchema = z.object({
  action: z.enum(['accept', 'dismiss']),
  /** Accept with a different category than the suggested one */
  categoryId: z.string().min(1).optional(),
  /** Accept as "exclude from budget" (e.g. a transfer between own accounts) */
  exclude: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export const POST = withApiErrors(async (request: NextRequest, { params }: Params) => {
  const { id } = await params
  const { action, categoryId, exclude: excludeRequested } = await parseJsonBody(request, bodySchema)

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, id))
  if (!tx) throw new HttpError(404, 'Transaction not found.')

  const now = new Date().toISOString()
  if (action === 'dismiss') {
    // Keep a marker so the same suggestion is not proposed again
    await db.update(transactions).set({ ...clearedSuggestion, suggestionSource: 'dismissed', updatedAt: now })
      .where(eq(transactions.id, id))
    return NextResponse.json({ success: true })
  }

  const exclude = excludeRequested ?? (!categoryId && tx.suggestedExclude)
  const finalCategory = exclude ? null : (categoryId ?? tx.suggestedCategoryId)
  if (!finalCategory && !exclude) throw new HttpError(400, 'There is no suggestion to accept.')

  const [updated] = await db.update(transactions).set({
    categoryId: finalCategory,
    excludeFromBudget: exclude,
    // A reviewed answer is the household's decision: it teaches the model
    categorySource: 'manual',
    ...clearedSuggestion,
    updatedAt: now,
  }).where(eq(transactions.id, id)).returning()

  return NextResponse.json({ transaction: updated })
})
