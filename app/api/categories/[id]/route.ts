import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categories, transactions, mappingRules, budgetLines } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { parseJsonBody, withApiErrors } from '@/lib/api'
import { categoryUpdateSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

export const PATCH = withApiErrors(async (request: NextRequest, { params }: Params) => {
  const { id } = await params
  const updates = await parseJsonBody(request, categoryUpdateSchema)

  const updated = await db.update(categories).set(updates).where(eq(categories.id, id)).returning()

  if (!updated.length) return NextResponse.json({ error: 'Category not found.' }, { status: 404 })
  return NextResponse.json({ category: updated[0] })
})

export const DELETE = withApiErrors(async (_request: NextRequest, { params }: Params) => {
  const { id } = await params
  const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id))
  if (!existing.length) {
    return NextResponse.json({ error: 'Category not found.' }, { status: 404 })
  }

  await db.transaction(async (tx) => {
    await tx.update(transactions).set({
      categoryId: null,
      categorySource: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(transactions.categoryId, id))
    await tx.delete(mappingRules).where(eq(mappingRules.categoryId, id))
    await tx.delete(budgetLines).where(eq(budgetLines.categoryId, id))
    await tx.delete(categories).where(eq(categories.id, id))
  })

  return NextResponse.json({ success: true })
})
