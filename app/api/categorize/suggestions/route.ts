import { NextResponse } from 'next/server'
import { alias } from 'drizzle-orm/pg-core'
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, transactions } from '@/db/schema'
import { withApiErrors } from '@/lib/api'

const suggested = alias(categories, 'suggested')

/** Pending suggestions to review, newest first. */
export const GET = withApiErrors(async () => {
  const rows = await db
    .select({
      id: transactions.id,
      fechaInicio: transactions.fechaInicio,
      descripcion: transactions.descripcion,
      importe: transactions.importe,
      suggestedCategoryId: transactions.suggestedCategoryId,
      suggestedCategoryName: suggested.name,
      suggestedCategoryColor: suggested.color,
      suggestedExclude: transactions.suggestedExclude,
      confidence: transactions.suggestionConfidence,
      source: transactions.suggestionSource,
      reason: transactions.suggestionReason,
    })
    .from(transactions)
    .leftJoin(suggested, eq(suggested.id, transactions.suggestedCategoryId))
    .where(and(
      isNull(transactions.categoryId),
      eq(transactions.excludeFromBudget, false),
      sql`${transactions.suggestionSource} IS NOT NULL AND ${transactions.suggestionSource} <> 'dismissed'`,
      or(sql`${transactions.suggestedCategoryId} IS NOT NULL`, eq(transactions.suggestedExclude, true)),
    ))
    .orderBy(desc(transactions.fechaInicio))
    .limit(200)

  return NextResponse.json({ suggestions: rows })
})
