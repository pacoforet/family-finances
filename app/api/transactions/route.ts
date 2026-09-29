import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions, categories } from '@/db/schema'
import { eq, desc, and, ilike, isNull, sql, count } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getPublicAppSettings } from '@/lib/app-settings'
import { MANUAL_TRANSACTION_STATE } from '@/lib/transaction-states'
import { invalidJsonResponse, readJsonBody } from '@/lib/api'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const month  = searchParams.get('month')    // 'YYYY-MM'
  const catId  = searchParams.get('categoryId')
  const search = searchParams.get('search')
  const uncategorized = searchParams.get('uncategorized') === 'true'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const limit  = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '50') || 50))
  const offset = (page - 1) * limit

  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'Month must use the YYYY-MM format.' }, { status: 400 })
  }

  const conditions = []

  if (month) {
    const [year, mon] = month.split('-')
    const start = `${year}-${mon}-01 00:00:00`
    const nextMonth = parseInt(mon) === 12
      ? `${parseInt(year) + 1}-01-01 00:00:00`
      : `${year}-${String(parseInt(mon) + 1).padStart(2, '0')}-01 00:00:00`
    // Same effective date as the budget summary: a transaction moved to another
    // month (budget_date) is listed in that month.
    const effectiveDate = sql`COALESCE(${transactions.budgetDate}, ${transactions.fechaInicio})`
    conditions.push(sql`${effectiveDate} >= ${start}`)
    conditions.push(sql`${effectiveDate} < ${nextMonth}`)
  }

  if (catId) {
    conditions.push(eq(transactions.categoryId, catId))
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

  const rows = await db
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
    .offset(offset)

  const totalRow = await db
    .select({ count: count() })
    .from(transactions)
    .where(where)

  return NextResponse.json({
    transactions: rows.map(r => ({
      ...r.transaction,
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
    })),
    total: totalRow[0].count,
    page,
    totalPages: Math.ceil(totalRow[0].count / limit),
  })
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request)
  if (!body) return invalidJsonResponse()
  const { descripcion, importe, fechaInicio, categoryId, notes } = body

  if (!descripcion || importe == null || !fechaInicio) {
    return NextResponse.json({ error: 'Description, amount, and date are required.' }, { status: 400 })
  }

  const amount = Number(importe)
  if (!Number.isFinite(amount)) {
    return NextResponse.json({ error: 'Amount must be a number.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const id = uuidv4()
  const settings = await getPublicAppSettings()

  const tx = await db.insert(transactions).values({
    id,
    descripcion,
    importe: amount,
    fechaInicio,
    categoryId:     categoryId ?? null,
    categorySource: categoryId ? 'manual' : null,
    notes:          notes ?? null,
    isManual:       true,
    state:          MANUAL_TRANSACTION_STATE,
    divisa:         settings.defaultCurrency,
    comision:       0,
    excludeFromBudget: false,
    createdAt:      now,
    updatedAt:      now,
  }).returning()

  return NextResponse.json({ transaction: tx[0] }, { status: 201 })
}
