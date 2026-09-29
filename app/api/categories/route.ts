import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { asc, max, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { HttpError, parseJsonBody, withApiErrors } from '@/lib/api'
import { categoryCreateSchema } from '@/lib/validation'

export const GET = withApiErrors(async () => {
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder))
  return NextResponse.json({ categories: cats })
})

export const POST = withApiErrors(async (request: NextRequest) => {
  const { name, color, icon } = await parseJsonBody(request, categoryCreateSchema)

  const existing = await db.query.categories.findFirst({
    where: (c, { eq }) => eq(sql`lower(${c.name})`, name.toLowerCase()),
  })
  if (existing) {
    throw new HttpError(409, 'A category with that name already exists.')
  }

  const [{ maxSort }] = await db.select({ maxSort: max(categories.sortOrder) }).from(categories)

  const cat = await db.insert(categories).values({
    id:        uuidv4(),
    name,
    color,
    icon,
    sortOrder: (maxSort ?? 0) + 1,
    createdAt: new Date().toISOString(),
  }).returning()

  return NextResponse.json({ category: cat[0] }, { status: 201 })
})
