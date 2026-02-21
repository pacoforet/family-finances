import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions, categories } from '@/db/schema'
import { eq, desc, and, like, isNull, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const month  = searchParams.get('month')    // 'YYYY-MM'
  const catId  = searchParams.get('categoryId')
  const search = searchParams.get('search')
  const uncategorized = searchParams.get('uncategorized') === 'true'
  const page   = parseInt(searchParams.get('page') ?? '1')
  const limit  = parseInt(searchParams.get('limit') ?? '50')
  const offset = (page - 1) * limit

  const conditions = []

  if (month) {
    const [year, mon] = month.split('-')
    const start = `${year}-${mon}-01 00:00:00`
    const nextMonth = parseInt(mon) === 12
      ? `${parseInt(year) + 1}-01-01 00:00:00`
      : `${year}-${String(parseInt(mon) + 1).padStart(2, '0')}-01 00:00:00`
    conditions.push(sql`${transactions.fechaInicio} >= ${start}`)
    conditions.push(sql`${transactions.fechaInicio} < ${nextMonth}`)
  }

  if (catId) {
    conditions.push(eq(transactions.categoryId, catId))
  }

  if (uncategorized) {
    conditions.push(isNull(transactions.categoryId))
    conditions.push(sql`${transactions.importe} < 0`)
  }

  if (search) {
    conditions.push(like(transactions.descripcion, `%${search}%`))
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
    .select({ count: sql<number>`count(*)` })
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
  const body = await request.json()
  const { descripcion, importe, fechaInicio, categoryId, notes } = body

  if (!descripcion || importe == null || !fechaInicio) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const id = uuidv4()

  const tx = await db.insert(transactions).values({
    id,
    descripcion,
    importe: parseFloat(importe),
    fechaInicio,
    categoryId:     categoryId ?? null,
    categorySource: categoryId ? 'manual' : null,
    notes:          notes ?? null,
    isManual:       true,
    state:          'COMPLETADO',
    divisa:         'EUR',
    comision:       0,
    excludeFromBudget: false,
    createdAt:      now,
    updatedAt:      now,
  }).returning()

  return NextResponse.json({ transaction: tx[0] }, { status: 201 })
}
