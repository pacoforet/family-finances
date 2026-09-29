import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { mappingRules, transactions } from '@/db/schema'
import { eq, asc, isNull, ne, or, inArray, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createRuleMatcher, normalizeMatchValue } from '@/lib/category-mapper'
import type { MappingRule } from '@/db/schema'
import { parseJsonBody, parseSearchParams, withApiErrors } from '@/lib/api'
import { mappingRuleCreateSchema, mappingRulesQuerySchema } from '@/lib/validation'

export const GET = withApiErrors(async (request: NextRequest) => {
  const { categoryId } = parseSearchParams(request, mappingRulesQuerySchema)

  const rows = categoryId
    ? await db.select().from(mappingRules)
        .where(eq(mappingRules.categoryId, categoryId))
        .orderBy(asc(mappingRules.priority))
    : await db.select().from(mappingRules).orderBy(asc(mappingRules.priority))

  return NextResponse.json({ rules: rows })
})

export const POST = withApiErrors(async (request: NextRequest) => {
  const body = await parseJsonBody(request, mappingRuleCreateSchema)
  const { categoryId, matchType, priority, notes } = body
  const matchValue = normalizeMatchValue(matchType, body.matchValue)
  const now = new Date().toISOString()

  // Upsert: a rule with the same type and value is reassigned instead of duplicated
  const [existing] = await db
    .select()
    .from(mappingRules)
    .where(and(eq(mappingRules.matchType, matchType), eq(mappingRules.matchValue, matchValue)))
    .limit(1)

  let rule: MappingRule
  if (existing) {
    const [updated] = await db
      .update(mappingRules)
      .set({ categoryId, isActive: true })
      .where(eq(mappingRules.id, existing.id))
      .returning()
    rule = updated
  } else {
    const [inserted] = await db.insert(mappingRules).values({
      id:         uuidv4(),
      categoryId,
      matchType,
      matchValue,
      priority,
      isActive:   true,
      notes,
      createdAt:  now,
    }).returning()
    rule = inserted
  }

  // Re-categorize transactions not categorized by hand that now resolve to this category
  const match = createRuleMatcher(await db.select().from(mappingRules))
  const candidates = await db
    .select({ id: transactions.id, descripcion: transactions.descripcion, categoryId: transactions.categoryId })
    .from(transactions)
    .where(or(ne(transactions.categorySource, 'manual'), isNull(transactions.categoryId)))

  const toUpdate = candidates.filter(tx =>
    tx.categoryId !== categoryId && match(tx.descripcion)?.categoryId === categoryId
  )

  if (toUpdate.length > 0) {
    await db.update(transactions)
      .set({ categoryId, categorySource: 'auto_rule', updatedAt: now })
      .where(inArray(transactions.id, toUpdate.map(tx => tx.id)))
  }

  return NextResponse.json({
    rule,
    recategorized: toUpdate.length,
    wasUpdated: !!existing,
  }, { status: 201 })
})
