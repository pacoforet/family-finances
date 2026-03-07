import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categories, transactions, mappingRules, budgetLines } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const allowed = ['name', 'color', 'icon', 'sortOrder', 'isIncome'] as const

  const updates: Record<string, unknown> = {}
  for (const field of allowed) {
    if (field in body) updates[field] = body[field]
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No updatable fields were provided.' }, { status: 400 })
  }

  await db.update(categories).set(updates).where(eq(categories.id, id))
  const updated = await db.select().from(categories).where(eq(categories.id, id))

  if (!updated.length) return NextResponse.json({ error: 'Category not found.' }, { status: 404 })
  return NextResponse.json({ category: updated[0] })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
}
