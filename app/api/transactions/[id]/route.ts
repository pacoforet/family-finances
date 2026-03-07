import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rows = await db.select().from(transactions).where(eq(transactions.id, id))
  if (!rows.length) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 })
  return NextResponse.json({ transaction: rows[0] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  // Fields the user is allowed to update
  const allowed = [
    'descripcion', 'importe', 'fechaInicio', 'categoryId',
    'notes', 'excludeFromBudget', 'splitAnnual', 'state', 'budgetDate',
  ] as const

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }

  for (const field of allowed) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  // Mark as manual when category is manually set
  if ('categoryId' in body && body.categoryId) {
    updates['categorySource'] = 'manual'
  }

  const existing = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, id))
  if (!existing.length) {
    return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 })
  }

  await db.update(transactions).set(updates).where(eq(transactions.id, id))

  const updated = await db.select().from(transactions).where(eq(transactions.id, id))
  return NextResponse.json({ transaction: updated[0] })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const existing = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, id))
  if (!existing.length) {
    return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 })
  }
  await db.delete(transactions).where(eq(transactions.id, id))
  return NextResponse.json({ success: true })
}
