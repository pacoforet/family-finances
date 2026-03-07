import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder))
  return NextResponse.json({ categories: cats })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, color, icon } = body

  if (!name || !color) {
    return NextResponse.json({ error: 'Name and color are required.' }, { status: 400 })
  }

  const existing = await db.query.categories.findFirst({
    where: (c, { eq }) => eq(c.name, name),
  })
  if (existing) {
    return NextResponse.json({ error: 'A category with that name already exists.' }, { status: 409 })
  }

  const maxSort = await db.query.categories.findMany({ orderBy: (c, { desc }) => [desc(c.sortOrder)] })
  const nextSort = maxSort.length > 0 ? maxSort[0].sortOrder + 1 : 1

  const now = new Date().toISOString()
  const cat = await db.insert(categories).values({
    id:        uuidv4(),
    name,
    color,
    icon:      icon ?? null,
    sortOrder: nextSort,
    createdAt: now,
  }).returning()

  return NextResponse.json({ category: cat[0] }, { status: 201 })
}
