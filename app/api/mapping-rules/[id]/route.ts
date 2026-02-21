import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { mappingRules } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const allowed = ['matchType', 'matchValue', 'priority', 'isActive', 'notes', 'categoryId'] as const

  const updates: Record<string, unknown> = {}
  for (const field of allowed) {
    if (field in body) {
      updates[field] = field === 'matchValue'
        ? String(body[field]).toLowerCase()
        : body[field]
    }
  }

  await db.update(mappingRules).set(updates).where(eq(mappingRules.id, id))
  const updated = await db.select().from(mappingRules).where(eq(mappingRules.id, id))

  if (!updated.length) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json({ rule: updated[0] })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.delete(mappingRules).where(eq(mappingRules.id, id))
  return NextResponse.json({ success: true })
}
