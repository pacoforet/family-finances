import { sql } from 'drizzle-orm'
import { pgTable, text, numeric, integer, boolean, uniqueIndex, index, timestamp, date } from 'drizzle-orm/pg-core'

// Money is stored as exact decimals; `mode: 'number'` keeps the JS API numeric.
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' })

// Dates keep a string API (`mode: 'string'`) so values round-trip unchanged:
// - instant: a moment in time (record bookkeeping), e.g. "2025-01-15 10:23:11.123+00"
// - wallClock: a bank's local date and time with no zone, e.g. "2025-01-15 10:23:11"
// - calendarDate: a day, e.g. "2025-01-01"
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })
const wallClock = (name: string) => timestamp(name, { mode: 'string' })
const calendarDate = (name: string) => date(name, { mode: 'string' })

// ─── App Settings ───────────────────────────────────────────────────────────
export const appSettings = pgTable('app_settings', {
  id:              text('id').primaryKey(),
  appName:         text('app_name').notNull(),
  householdName:   text('household_name').notNull(),
  defaultCurrency: text('default_currency').notNull().default('USD'),
  locale:          text('locale').notNull().default('en-US'),
  timezone:        text('timezone').notNull().default('UTC'),
  householdSize:   integer('household_size').notNull().default(1),
  setupCompleted:  boolean('setup_completed').notNull().default(false),
  createdAt:       instant('created_at').notNull(),
  updatedAt:       instant('updated_at').notNull(),
})

// ─── Categories ─────────────────────────────────────────────────────────────
export const categories = pgTable('categories', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull().unique(),
  color:     text('color').notNull(),
  icon:      text('icon'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isIncome:  boolean('is_income').default(false).notNull(),
  createdAt: instant('created_at').notNull(),
})

// ─── Budget Lines ────────────────────────────────────────────────────────────
export const budgetLines = pgTable('budget_lines', {
  id:         text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  year:       integer('year').notNull(),
  month:      integer('month').notNull(),
  amount:     money('amount').notNull(),
  notes:      text('notes'),
}, (t) => [
  uniqueIndex('budget_lines_category_year_month_unique').on(t.categoryId, t.year, t.month),
])

// ─── Mapping Rules ───────────────────────────────────────────────────────────
export const mappingRules = pgTable('mapping_rules', {
  id:          text('id').primaryKey(),
  categoryId:  text('category_id').notNull().references(() => categories.id),
  matchType:   text('match_type').notNull(),
  matchValue:  text('match_value').notNull(),
  priority:    integer('priority').default(100).notNull(),
  isActive:    boolean('is_active').default(true).notNull(),
  notes:       text('notes'),
  createdAt:   instant('created_at').notNull(),
})

// ─── Import Batches ──────────────────────────────────────────────────────────
export const importBatches = pgTable('import_batches', {
  id:            text('id').primaryKey(),
  fileName:      text('file_name').notNull(),
  importedAt:    instant('imported_at').notNull(),
  rowsTotal:     integer('rows_total').notNull(),
  rowsImported:  integer('rows_imported').notNull(),
  rowsSkipped:   integer('rows_skipped').notNull(),
  rowsErrored:   integer('rows_errored').notNull(),
})

// ─── Transactions ────────────────────────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id:                text('id').primaryKey(),
  importBatchId:     text('import_batch_id').references(() => importBatches.id),
  dedupHash:         text('dedup_hash').unique(),

  tipo:              text('tipo'),
  producto:          text('producto'),
  fechaInicio:       wallClock('fecha_inicio').notNull(),
  fechaFin:          wallClock('fecha_fin'),
  descripcion:       text('descripcion').notNull(),
  importe:           money('importe').notNull(),
  comision:          money('comision').default(0),
  divisa:            text('divisa').default('EUR'),
  state:             text('state'),
  saldo:             money('saldo'),

  categoryId:        text('category_id').references(() => categories.id),
  categorySource:    text('category_source'),
  notes:             text('notes'),
  isManual:          boolean('is_manual').default(false).notNull(),
  excludeFromBudget: boolean('exclude_from_budget').default(false).notNull(),
  splitAnnual:       boolean('split_annual').default(false).notNull(),
  budgetDate:        calendarDate('budget_date'),
  createdAt:         instant('created_at').notNull(),
  updatedAt:         instant('updated_at').notNull(),
}, (t) => [
  index('transactions_fecha_inicio_idx').on(t.fechaInicio),
  index('transactions_category_id_idx').on(t.categoryId),
  // Month filters and budget summaries select on the effective date.
  index('transactions_effective_date_idx').on(sql`COALESCE(${t.budgetDate}, ${t.fechaInicio})`),
])

// ─── Type exports ────────────────────────────────────────────────────────────
export type Category     = typeof categories.$inferSelect
export type BudgetLine   = typeof budgetLines.$inferSelect
export type MappingRule  = typeof mappingRules.$inferSelect
export type ImportBatch  = typeof importBatches.$inferSelect
export type Transaction  = typeof transactions.$inferSelect
export type AppSettings  = typeof appSettings.$inferSelect

export type NewCategory    = typeof categories.$inferInsert
export type NewBudgetLine  = typeof budgetLines.$inferInsert
export type NewMappingRule = typeof mappingRules.$inferInsert
export type NewTransaction = typeof transactions.$inferInsert
export type NewAppSettings = typeof appSettings.$inferInsert
