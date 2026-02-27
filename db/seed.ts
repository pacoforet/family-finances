/**
 * Run with: npx tsx db/seed.ts
 * Seeds initial categories, budget lines, and mapping rules in PostgreSQL.
 */
import { v4 as uuidv4 } from 'uuid'
import { and, eq } from 'drizzle-orm'
import { db } from './index'
import * as schema from './schema'

const now = new Date().toISOString()
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const CATEGORIES = [
  { name: 'Alquiler', color: '#3B82F6', icon: 'home', sortOrder: 1 },
  { name: 'Suministros', color: '#14B8A6', icon: 'zap', sortOrder: 2 },
  { name: 'Limpieza Carla', color: '#8B5CF6', icon: 'sparkles', sortOrder: 3 },
  { name: 'Comida', color: '#22C55E', icon: 'shopping-cart', sortOrder: 4 },
  { name: 'Ocio y varios', color: '#F97316', icon: 'coffee', sortOrder: 5 },
  { name: 'Deuda Tere', color: '#EF4444', icon: 'credit-card', sortOrder: 6 },
  { name: 'Cookidoo', color: '#EC4899', icon: 'chef-hat', sortOrder: 7 },
  { name: 'Seguro Hogar', color: '#6B7280', icon: 'shield', sortOrder: 8 },
  { name: 'IKEA Financiado', color: '#EAB308', icon: 'sofa', sortOrder: 9 },
  { name: 'Sin categoría', color: '#9CA3AF', icon: 'circle-help', sortOrder: 99 },
]

const BUDGET_AMOUNTS: Record<string, number> = {
  Alquiler: 1600.0,
  Suministros: 215.0,
  'Limpieza Carla': 470.0,
  Comida: 300.0,
  'Ocio y varios': 300.0,
  'Deuda Tere': 100.0,
  Cookidoo: 5.83,
  'Seguro Hogar': 24.0,
  'IKEA Financiado': 30.51,
}

const RULES: Array<{
  catName: string
  matchType: string
  matchValue: string
  priority: number
  notes?: string
}> = [
  { catName: 'Alquiler', matchType: 'contains', matchValue: 'vilana residencial', priority: 10, notes: 'Casero' },
  { catName: 'Alquiler', matchType: 'contains', matchValue: 'vilana', priority: 15 },
  { catName: 'Suministros', matchType: 'contains', matchValue: 'octopus energy', priority: 10, notes: 'Gas/Luz' },
  { catName: 'Suministros', matchType: 'contains', matchValue: 'gc re octopus', priority: 10 },
  { catName: 'Suministros', matchType: 'contains', matchValue: 'o2 fibra', priority: 10, notes: 'Internet O2' },
  { catName: 'Suministros', matchType: 'contains', matchValue: 'telefonica', priority: 15 },
  { catName: 'Suministros', matchType: 'contains', matchValue: 'endesa', priority: 10 },
  { catName: 'Suministros', matchType: 'contains', matchValue: 'naturgy', priority: 10 },
  { catName: 'Suministros', matchType: 'contains', matchValue: 'agbar', priority: 10 },
  { catName: 'Suministros', matchType: 'contains', matchValue: 'aigues', priority: 10 },
  { catName: 'IKEA Financiado', matchType: 'contains', matchValue: 'caixabank payments', priority: 5, notes: 'Financiación IKEA via Caixabank' },
  { catName: 'IKEA Financiado', matchType: 'contains', matchValue: 'ikea', priority: 10 },
  { catName: 'IKEA Financiado', matchType: 'contains', matchValue: 'ikano', priority: 5, notes: 'Ikano Bank = financiadora IKEA' },
  { catName: 'Comida', matchType: 'contains', matchValue: 'suma alella', priority: 10, notes: 'Super barrio' },
  { catName: 'Comida', matchType: 'starts_with', matchValue: 'suma ', priority: 20 },
  { catName: 'Comida', matchType: 'contains', matchValue: 'ametller', priority: 10 },
  { catName: 'Comida', matchType: 'contains', matchValue: 'maxi masnou', priority: 10 },
  { catName: 'Comida', matchType: 'contains', matchValue: 'el pati', priority: 20 },
  { catName: 'Comida', matchType: 'contains', matchValue: 'carrefour', priority: 20 },
  { catName: 'Comida', matchType: 'contains', matchValue: 'mercadona', priority: 20 },
  { catName: 'Comida', matchType: 'contains', matchValue: 'lidl', priority: 20 },
  { catName: 'Comida', matchType: 'starts_with', matchValue: 'glovo', priority: 25 },
  { catName: 'Comida', matchType: 'starts_with', matchValue: 'just eat', priority: 25 },
  { catName: 'Ocio y varios', matchType: 'contains', matchValue: 'repsol', priority: 20, notes: 'Gasolina' },
  { catName: 'Ocio y varios', matchType: 'contains', matchValue: 'bp', priority: 20, notes: 'Gasolina' },
  { catName: 'Ocio y varios', matchType: 'contains', matchValue: 'netflix', priority: 10 },
  { catName: 'Ocio y varios', matchType: 'contains', matchValue: 'spotify', priority: 10 },
  { catName: 'Ocio y varios', matchType: 'contains', matchValue: 'amazon', priority: 30 },
  { catName: 'Deuda Tere', matchType: 'contains', matchValue: 'tere', priority: 10 },
  { catName: 'Deuda Tere', matchType: 'contains', matchValue: 'teresa', priority: 10 },
  { catName: 'Cookidoo', matchType: 'exact', matchValue: 'cookidoo', priority: 5 },
  { catName: 'Cookidoo', matchType: 'contains', matchValue: 'thermomix', priority: 10 },
  { catName: 'Seguro Hogar', matchType: 'contains', matchValue: 'mutua', priority: 10 },
  { catName: 'Seguro Hogar', matchType: 'contains', matchValue: 'seguros', priority: 15 },
  { catName: 'Seguro Hogar', matchType: 'contains', matchValue: 'axa', priority: 10 },
]

async function main() {
  console.log('🌱 Seeding database...')

  for (const cat of CATEGORIES) {
    await db
      .insert(schema.categories)
      .values({
        id: uuidv4(),
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isIncome: false,
        createdAt: now,
      })
      .onConflictDoNothing({ target: schema.categories.name })
  }

  const allCategories = await db.select().from(schema.categories)
  const categoryIds = new Map(allCategories.map((c) => [c.name, c.id]))

  for (const [catName, amount] of Object.entries(BUDGET_AMOUNTS)) {
    const catId = categoryIds.get(catName)
    if (!catId) continue

    const existing = await db
      .select({ id: schema.budgetLines.id })
      .from(schema.budgetLines)
      .where(
        and(
          eq(schema.budgetLines.categoryId, catId),
          eq(schema.budgetLines.year, currentYear),
          eq(schema.budgetLines.month, currentMonth)
        )
      )

    if (existing.length > 0) continue

    await db.insert(schema.budgetLines).values({
      id: uuidv4(),
      categoryId: catId,
      year: currentYear,
      month: currentMonth,
      amount,
      notes: null,
    })
  }

  for (const rule of RULES) {
    const catId = categoryIds.get(rule.catName)
    if (!catId) continue

    const existing = await db
      .select({ id: schema.mappingRules.id })
      .from(schema.mappingRules)
      .where(
        and(
          eq(schema.mappingRules.categoryId, catId),
          eq(schema.mappingRules.matchType, rule.matchType),
          eq(schema.mappingRules.matchValue, rule.matchValue)
        )
      )

    if (existing.length > 0) continue

    await db.insert(schema.mappingRules).values({
      id: uuidv4(),
      categoryId: catId,
      matchType: rule.matchType,
      matchValue: rule.matchValue,
      priority: rule.priority,
      isActive: true,
      notes: rule.notes ?? null,
      createdAt: now,
    })
  }

  console.log('✅ Seed complete!')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
