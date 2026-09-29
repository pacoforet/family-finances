import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions, categories } from '@/db/schema'
import { eq, desc, and, ilike, isNull, sql, count, gte, lt, type SQL } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getPublicAppSettings } from '@/lib/app-settings'
import { MANUAL_TRANSACTION_STATE } from '@/lib/transaction-states'
import { parseJsonBody, parseSearchParams, withApiErrors } from '@/lib/api'
import { effectiveDate, monthStart } from '@/lib/budget-data'
import { transactionCreateSchema, transactionsQuerySchema } from '@/lib/validation'

export const GET = withApiErrors(async (request: NextRequest) => {
  const { month, categoryId, search, uncategorized, page, limit } =
    parseSearchParams(request, transactionsQuerySchema)
  const offset = (page - 1) * limit

  const conditions: SQL[] = []

  if (month) {
    const [year, mon] = month.split('-').map(Number)
    const first = year * 12 + (mon - 1)
    // Same effective date as the budget summary: a transaction moved to another
    // month (budget_date) is listed in that month.
    conditions.push(gte(effectiveDate, monthStart(first)), lt(effectiveDate, monthStart(first + 1)))
  }

  if (categoryId) {
    conditions.push(eq(transactions.categoryId, categoryId))
  }

  if (uncategorized) {
    conditions.push(isNull(transactions.categoryId))
    conditions.push(sql`${transactions.importe} < 0`)
  }

  if (search) {
    // Case-insensitive, with LIKE wildcards in the user's text matched literally.
    const escaped = search.replace(/[\\%_]/g, (ch) => `\\${ch}`)
    conditions.push(ilike(transactions.descripcion, `%${escaped}%`))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        transaction: transactions,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(where)
      .orderBy(desc(transactions.fechaInicio))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(transactions).where(where),
  ])

  return NextResponse.json({
    transactions: rows.map(r => ({
      ...r.transaction,
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
})

export const POST = withApiErrors(async (request: NextRequest) => {
  const { descripcion, importe, fechaInicio, categoryId, notes } =
    await parseJsonBody(request, transactionCreateSchema)

  const now = new Date().toISOString()
  const settings = await getPublicAppSettings()

  const tx = await db.insert(transactions).values({
    id:             uuidv4(),
    descripcion,
    importe,
    fechaInicio,
    categoryId,
    categorySource: categoryId ? 'manual' : null,
    notes,
    isManual:       true,
    state:          MANUAL_TRANSACTION_STATE,
    divisa:         settings.defaultCurrency,
    comision:       0,
    excludeFromBudget: false,
    createdAt:      now,
    updatedAt:      now,
  }).returning()

  return NextResponse.json({ transaction: tx[0] }, { status: 201 })
})
