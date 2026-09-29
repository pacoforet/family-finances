import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { mappingRules } from '@/db/schema'
import { findMatchingRule } from '@/lib/category-mapper'
import { parseJsonBody, withApiErrors } from '@/lib/api'
import { mappingRuleTestSchema } from '@/lib/validation'

export const POST = withApiErrors(async (request: NextRequest) => {
  const { description } = await parseJsonBody(request, mappingRuleTestSchema)

  const matched = findMatchingRule(description, await db.select().from(mappingRules))

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
})
