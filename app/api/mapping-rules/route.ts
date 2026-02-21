import { NextRequest, NextResponse } from 'next/server'
import { db, sqlite } from '@/db'
import { mappingRules } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
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
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const validMatchTypes = ['contains', 'exact', 'starts_with', 'regex']
  if (!validMatchTypes.includes(matchType)) {
    return NextResponse.json({ error: 'Tipo de regla inválido' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const rule = await db.insert(mappingRules).values({
    id:         uuidv4(),
    categoryId,
    matchType,
    matchValue: matchValue.toLowerCase(),
    priority:   priority ?? 100,
    isActive:   true,
    notes:      notes ?? null,
    createdAt:  now,
  }).returning()

  // Re-categorize previously uncategorized transactions that match this new rule
  const allRules = await db.select().from(mappingRules).all() as MappingRule[]
  const uncategorized = sqlite.prepare(
    "SELECT * FROM transactions WHERE category_source != 'manual' OR category_id IS NULL"
  ).all() as Array<{ id: string; descripcion: string }>

  const toUpdate = uncategorized.filter(tx => {
    return applyMappingRules(tx.descripcion, allRules) === categoryId
  })

  if (toUpdate.length > 0) {
    const update = sqlite.transaction(() => {
      for (const tx of toUpdate) {
        sqlite.prepare(
          "UPDATE transactions SET category_id = ?, category_source = 'auto_rule', updated_at = ? WHERE id = ?"
        ).run(categoryId, now, tx.id)
      }
    })
    update()
  }

  return NextResponse.json({
    rule: rule[0],
    recategorized: toUpdate.length,
  }, { status: 201 })
}
