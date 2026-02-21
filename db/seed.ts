/**
 * Run with: npx tsx db/seed.ts
 * Seeds initial categories, budget lines, and mapping rules
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), 'data', 'family-finances.db')
const dir = path.dirname(DB_PATH)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })

// Run migrations first
migrate(db, { migrationsFolder: './db/migrations' })

const now = new Date().toISOString()
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

// ─── Categories ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Alquiler',        color: '#3B82F6', icon: 'home',         sortOrder: 1  },
  { name: 'Suministros',     color: '#14B8A6', icon: 'zap',          sortOrder: 2  },
  { name: 'Limpieza Carla',  color: '#8B5CF6', icon: 'sparkles',     sortOrder: 3  },
  { name: 'Comida',          color: '#22C55E', icon: 'shopping-cart', sortOrder: 4  },
  { name: 'Ocio y varios',   color: '#F97316', icon: 'coffee',        sortOrder: 5  },
  { name: 'Deuda Tere',      color: '#EF4444', icon: 'credit-card',   sortOrder: 6  },
  { name: 'Cookidoo',        color: '#EC4899', icon: 'chef-hat',      sortOrder: 7  },
  { name: 'Seguro Hogar',    color: '#6B7280', icon: 'shield',        sortOrder: 8  },
  { name: 'IKEA Financiado', color: '#EAB308', icon: 'sofa',          sortOrder: 9  },
  { name: 'Sin categoría',   color: '#9CA3AF', icon: 'circle-help',   sortOrder: 99 },
]

// ─── Budget amounts (monthly) ────────────────────────────────────────────────
const BUDGET_AMOUNTS: Record<string, number> = {
  'Alquiler':        1600.00,
  'Suministros':     215.00,
  'Limpieza Carla':  470.00,
  'Comida':          300.00,
  'Ocio y varios':   300.00,
  'Deuda Tere':      100.00,
  'Cookidoo':        5.83,
  'Seguro Hogar':    24.00,
  'IKEA Financiado': 30.51,
}

console.log('🌱 Seeding database...')

// Insert categories (skip if already exist)
const categoryIds: Record<string, string> = {}
for (const cat of CATEGORIES) {
  const existing = db.select().from(schema.categories)
    .where(schema.categories.name.name ? undefined : undefined)
    .all()
    .find((c: schema.Category) => c.name === cat.name)

  if (existing) {
    categoryIds[cat.name] = existing.id
    console.log(`  ✓ Category already exists: ${cat.name}`)
    continue
  }

  const id = uuidv4()
  categoryIds[cat.name] = id
  db.insert(schema.categories).values({ id, ...cat, createdAt: now }).run()
  console.log(`  + Category created: ${cat.name}`)
}

// Insert budget lines for current month (skip if already exist)
for (const [catName, amount] of Object.entries(BUDGET_AMOUNTS)) {
  const catId = categoryIds[catName]
  if (!catId) continue

  const existing = sqlite.prepare(
    'SELECT id FROM budget_lines WHERE category_id = ? AND year = ? AND month = ?'
  ).get(catId, currentYear, currentMonth)

  if (existing) {
    console.log(`  ✓ Budget line already exists: ${catName} ${currentYear}/${currentMonth}`)
    continue
  }

  db.insert(schema.budgetLines).values({
    id: uuidv4(),
    categoryId: catId,
    year: currentYear,
    month: currentMonth,
    amount,
  }).run()
  console.log(`  + Budget line: ${catName} = ${amount}€ (${currentYear}/${currentMonth})`)
}

// ─── Mapping Rules ────────────────────────────────────────────────────────────
const RULES: Array<{ catName: string; matchType: string; matchValue: string; priority: number; notes?: string }> = [
  // Alquiler
  { catName: 'Alquiler',        matchType: 'contains',    matchValue: 'vilana residencial', priority: 10, notes: 'Casero' },
  { catName: 'Alquiler',        matchType: 'contains',    matchValue: 'vilana',             priority: 15 },

  // Suministros
  { catName: 'Suministros',     matchType: 'contains',    matchValue: 'octopus energy',     priority: 10, notes: 'Gas/Luz' },
  { catName: 'Suministros',     matchType: 'contains',    matchValue: 'gc re octopus',      priority: 10 },
  { catName: 'Suministros',     matchType: 'contains',    matchValue: 'o2 fibra',           priority: 10, notes: 'Internet O2' },
  { catName: 'Suministros',     matchType: 'contains',    matchValue: 'telefonica',         priority: 15 },
  { catName: 'Suministros',     matchType: 'contains',    matchValue: 'endesa',             priority: 10 },
  { catName: 'Suministros',     matchType: 'contains',    matchValue: 'naturgy',            priority: 10 },
  { catName: 'Suministros',     matchType: 'contains',    matchValue: 'agbar',              priority: 10 },
  { catName: 'Suministros',     matchType: 'contains',    matchValue: 'aigues',             priority: 10 },

  // IKEA Financiado
  { catName: 'IKEA Financiado', matchType: 'contains',    matchValue: 'caixabank payments', priority: 5, notes: 'Financiación IKEA via Caixabank' },
  { catName: 'IKEA Financiado', matchType: 'contains',    matchValue: 'ikea',               priority: 10 },
  { catName: 'IKEA Financiado', matchType: 'contains',    matchValue: 'ikano',              priority: 5, notes: 'Ikano Bank = financiadora IKEA' },

  // Comida
  { catName: 'Comida',          matchType: 'contains',    matchValue: 'suma alella',        priority: 10, notes: 'Super barrio' },
  { catName: 'Comida',          matchType: 'starts_with', matchValue: 'suma ',              priority: 20 },
  { catName: 'Comida',          matchType: 'contains',    matchValue: 'ametller',           priority: 10 },
  { catName: 'Comida',          matchType: 'contains',    matchValue: 'maxi masnou',        priority: 10 },
  { catName: 'Comida',          matchType: 'contains',    matchValue: 'el pati',            priority: 20 },
  { catName: 'Comida',          matchType: 'contains',    matchValue: 'carrefour',          priority: 20 },
  { catName: 'Comida',          matchType: 'contains',    matchValue: 'mercadona',          priority: 20 },
  { catName: 'Comida',          matchType: 'contains',    matchValue: 'lidl',               priority: 20 },
  { catName: 'Comida',          matchType: 'starts_with', matchValue: 'glovo',              priority: 25 },
  { catName: 'Comida',          matchType: 'starts_with', matchValue: 'just eat',           priority: 25 },

  // Ocio y varios
  { catName: 'Ocio y varios',   matchType: 'contains',    matchValue: 'repsol',             priority: 20, notes: 'Gasolina' },
  { catName: 'Ocio y varios',   matchType: 'contains',    matchValue: 'bp',                 priority: 20, notes: 'Gasolina' },
  { catName: 'Ocio y varios',   matchType: 'contains',    matchValue: 'netflix',            priority: 10 },
  { catName: 'Ocio y varios',   matchType: 'contains',    matchValue: 'spotify',            priority: 10 },
  { catName: 'Ocio y varios',   matchType: 'contains',    matchValue: 'amazon',             priority: 30 },

  // Deuda Tere
  { catName: 'Deuda Tere',      matchType: 'contains',    matchValue: 'tere',               priority: 10 },
  { catName: 'Deuda Tere',      matchType: 'contains',    matchValue: 'teresa',             priority: 10 },

  // Cookidoo
  { catName: 'Cookidoo',        matchType: 'exact',       matchValue: 'cookidoo',           priority: 5 },
  { catName: 'Cookidoo',        matchType: 'contains',    matchValue: 'thermomix',          priority: 10 },

  // Seguro Hogar
  { catName: 'Seguro Hogar',    matchType: 'contains',    matchValue: 'mutua',              priority: 10 },
  { catName: 'Seguro Hogar',    matchType: 'contains',    matchValue: 'seguros',            priority: 15 },
  { catName: 'Seguro Hogar',    matchType: 'contains',    matchValue: 'axa',                priority: 10 },
]

for (const rule of RULES) {
  const catId = categoryIds[rule.catName]
  if (!catId) continue

  const existing = sqlite.prepare(
    'SELECT id FROM mapping_rules WHERE category_id = ? AND match_type = ? AND match_value = ?'
  ).get(catId, rule.matchType, rule.matchValue)

  if (existing) continue

  db.insert(schema.mappingRules).values({
    id: uuidv4(),
    categoryId: catId,
    matchType: rule.matchType,
    matchValue: rule.matchValue,
    priority: rule.priority,
    isActive: true,
    notes: rule.notes,
    createdAt: now,
  }).run()
}

console.log(`  + ${RULES.length} mapping rules seeded`)
console.log('\n✅ Seed complete!')

sqlite.close()
