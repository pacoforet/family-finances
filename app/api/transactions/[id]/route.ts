import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { parseJsonBody, withApiErrors } from '@/lib/api'
import { transactionUpdateSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

export const GET = withApiErrors(async (_request: NextRequest, { params }: Params) => {
  const { id } = await params
  const rows = await db.select().from(transactions).where(eq(transactions.id, id))
  if (!rows.length) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 })
  return NextResponse.json({ transaction: rows[0] })
})

export const PATCH = withApiErrors(async (request: NextRequest, { params }: Params) => {
  const { id } = await params
  const body = await parseJsonBody(request, transactionUpdateSchema)

  const updates: Partial<typeof transactions.$inferInsert> = {
    ...body,
    updatedAt: new Date().toISOString(),
  }

  // Mark as manual when category is manually set; clearing it clears the source
  if (body.categoryId !== undefined) {
    updates.categorySource = body.categoryId ? 'manual' : null
  }

  const updated = await db.update(transactions).set(updates).where(eq(transactions.id, id)).returning()
  if (!updated.length) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 })
  return NextResponse.json({ transaction: updated[0] })
})

export const DELETE = withApiErrors(async (_request: NextRequest, { params }: Params) => {
  const { id } = await params
  const deleted = await db.delete(transactions).where(eq(transactions.id, id)).returning({ id: transactions.id })
  if (!deleted.length) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 })
  return NextResponse.json({ success: true })
})
