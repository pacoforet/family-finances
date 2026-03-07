import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { mappingRules } from '@/db/schema'
import { findMatchingRule } from '@/lib/category-mapper'
import type { MappingRule } from '@/db/schema'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { description } = body

  if (!description) {
    return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
  }

  const rules = await db.select().from(mappingRules) as MappingRule[]
  const matched = findMatchingRule(description, rules)

  if (!matched) {
    return NextResponse.json({ matched: false })
  }

  const cat = await db.query.categories.findFirst({
    where: (c, { eq }) => eq(c.id, matched.categoryId),
  })

  return NextResponse.json({
    matched: true,
    rule: matched,
    category: cat,
  })
}
