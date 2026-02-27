import { pgTable, text, real, integer, boolean } from 'drizzle-orm/pg-core'

// ─── Categories ─────────────────────────────────────────────────────────────
export const categories = pgTable('categories', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull().unique(),
  color:     text('color').notNull(),
  icon:      text('icon'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isIncome:  boolean('is_income').default(false).notNull(),
  createdAt: text('created_at').notNull(),
})

// ─── Budget Lines ────────────────────────────────────────────────────────────
export const budgetLines = pgTable('budget_lines', {
  id:         text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  year:       integer('year').notNull(),
  month:      integer('month').notNull(),
  amount:     real('amount').notNull(),
  notes:      text('notes'),
})

// ─── Mapping Rules ───────────────────────────────────────────────────────────
export const mappingRules = pgTable('mapping_rules', {
  id:          text('id').primaryKey(),
  categoryId:  text('category_id').notNull().references(() => categories.id),
  matchType:   text('match_type').notNull(),
  matchValue:  text('match_value').notNull(),
  priority:    integer('priority').default(100).notNull(),
  isActive:    boolean('is_active').default(true).notNull(),
  notes:       text('notes'),
  createdAt:   text('created_at').notNull(),
})

// ─── Import Batches ──────────────────────────────────────────────────────────
export const importBatches = pgTable('import_batches', {
  id:            text('id').primaryKey(),
  fileName:      text('file_name').notNull(),
  importedAt:    text('imported_at').notNull(),
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
  fechaInicio:       text('fecha_inicio').notNull(),
  fechaFin:          text('fecha_fin'),
  descripcion:       text('descripcion').notNull(),
  importe:           real('importe').notNull(),
  comision:          real('comision').default(0),
  divisa:            text('divisa').default('EUR'),
  state:             text('state'),
  saldo:             real('saldo'),

  categoryId:        text('category_id').references(() => categories.id),
  categorySource:    text('category_source'),
  notes:             text('notes'),
  isManual:          boolean('is_manual').default(false).notNull(),
  excludeFromBudget: boolean('exclude_from_budget').default(false).notNull(),
  splitAnnual:       boolean('split_annual').default(false).notNull(),
  budgetDate:        text('budget_date'),
  createdAt:         text('created_at').notNull(),
  updatedAt:         text('updated_at').notNull(),
})

// ─── Type exports ────────────────────────────────────────────────────────────
export type Category     = typeof categories.$inferSelect
export type BudgetLine   = typeof budgetLines.$inferSelect
export type MappingRule  = typeof mappingRules.$inferSelect
export type ImportBatch  = typeof importBatches.$inferSelect
export type Transaction  = typeof transactions.$inferSelect

export type NewCategory    = typeof categories.$inferInsert
export type NewBudgetLine  = typeof budgetLines.$inferInsert
export type NewMappingRule = typeof mappingRules.$inferInsert
export type NewTransaction = typeof transactions.$inferInsert
