import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { mappingRules } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { HttpError, parseJsonBody, withApiErrors } from '@/lib/api'
import { normalizeMatchValue } from '@/lib/category-mapper'
import { mappingRuleUpdateSchema } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

function isValidRegex(pattern: string) {
  try {
    new RegExp(pattern, 'i')
    return true
  } catch {
    return false
  }
}

export const PATCH = withApiErrors(async (request: NextRequest, { params }: Params) => {
  const { id } = await params
  const updates = await parseJsonBody(request, mappingRuleUpdateSchema)

  const [current] = await db.select().from(mappingRules).where(eq(mappingRules.id, id))
  if (!current) return NextResponse.json({ error: 'Rule not found.' }, { status: 404 })

  // Type and value are validated together, since either may change alone
  const matchType = updates.matchType ?? current.matchType
  if (updates.matchValue !== undefined || updates.matchType !== undefined) {
    const matchValue = normalizeMatchValue(matchType, updates.matchValue ?? current.matchValue)
    if (matchType === 'regex' && !isValidRegex(matchValue)) {
      throw new HttpError(400, 'matchValue: must be a valid regular expression')
    }
    updates.matchValue = matchValue
  }

  const [updated] = await db.update(mappingRules).set(updates).where(eq(mappingRules.id, id)).returning()
  return NextResponse.json({ rule: updated })
})

export const DELETE = withApiErrors(async (_request: NextRequest, { params }: Params) => {
  const { id } = await params
  const deleted = await db.delete(mappingRules).where(eq(mappingRules.id, id)).returning({ id: mappingRules.id })
  if (!deleted.length) return NextResponse.json({ error: 'Rule not found.' }, { status: 404 })
  return NextResponse.json({ success: true })
})
