import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { mappingRules, transactions } from '@/db/schema'
import { eq, asc, isNull, ne, or, inArray, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { applyMappingRules } from '@/lib/category-mapper'
import type { MappingRule } from '@/db/schema'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const categoryId = searchParams.get('categoryId')

  const rows = categoryId
    ? await db.select().from(mappingRules)
        .where(eq(mappingRules.categoryId, categoryId))
        .orderBy(asc(mappingRules.priority))
    : await db.select().from(mappingRules).orderBy(asc(mappingRules.priority))

  return NextResponse.json({ rules: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { categoryId, matchType, matchValue, priority, notes } = body

  if (!categoryId || !matchType || !matchValue) {
    return NextResponse.json({ error: 'Category, match type, and match value are required.' }, { status: 400 })
  }

  const validMatchTypes = ['contains', 'exact', 'starts_with', 'regex']
  if (!validMatchTypes.includes(matchType)) {
    return NextResponse.json({ error: 'Invalid rule match type.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const matchValueLower = matchValue.toLowerCase()

  // Upsert: if an exact-typed rule with the same matchValue already exists, update it
  const [existing] = await db
    .select()
    .from(mappingRules)
    .where(and(eq(mappingRules.matchType, matchType), eq(mappingRules.matchValue, matchValueLower)))
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
      matchValue: matchValueLower,
      priority:   priority ?? 100,
      isActive:   true,
      notes:      notes ?? null,
      createdAt:  now,
    }).returning()
    rule = inserted
  }

  // Re-categorize previously uncategorized transactions that match this new rule
  const allRules = await db.select().from(mappingRules) as MappingRule[]
  const uncategorized = await db
    .select({ id: transactions.id, descripcion: transactions.descripcion })
    .from(transactions)
    .where(or(ne(transactions.categorySource, 'manual'), isNull(transactions.categoryId)))

  const toUpdate = uncategorized.filter(tx =>
    applyMappingRules(tx.descripcion, allRules) === categoryId
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
}
