import { z } from 'zod'
import { MATCH_TYPES } from '@/lib/category-mapper'

// ─── Shared primitives ──────────────────────────────────────────────────────

const id = z.string().trim().min(1).max(100)
const nullableText = (max: number) => z.string().trim().max(max).nullish().transform(v => v || null)

/** A finite amount; numeric strings are accepted because form inputs send them. */
const amount = z.union([z.number(), z.string().trim().min(1)])
  .transform(v => Number(v))
  .refine(Number.isFinite, 'must be a number')

const year = z.coerce.number().int().min(1900).max(9999)
const month = z.coerce.number().int().min(1).max(12)

/** "YYYY-MM-DD" optionally followed by " HH:MM" or " HH:MM:SS" (wall-clock time). */
const dateTime = z.string().trim()
  .regex(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/, 'must be YYYY-MM-DD or YYYY-MM-DD HH:MM:SS')
  .transform(v => v.replace('T', ' '))

/** A calendar date; a trailing time is accepted and dropped. */
const calendarDate = dateTime.transform(v => v.slice(0, 10))

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb color')

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, 'i')
    return true
  } catch {
    return false
  }
}

function atLeastOneField<T extends object>(value: T) {
  return Object.values(value).some(v => v !== undefined)
}

// ─── App settings ───────────────────────────────────────────────────────────

export const appSettingsSchema = z.object({
  appName: z.string().trim().min(1).max(100),
  householdName: z.string().trim().min(1).max(100),
  defaultCurrency: z.string().trim().toUpperCase().refine(code => {
    try {
      new Intl.NumberFormat('en', { style: 'currency', currency: code })
      return /^[A-Z]{3}$/.test(code)
    } catch {
      return false
    }
  }, 'must be an ISO 4217 currency code'),
  locale: z.string().trim().refine(locale => {
    try {
      return Intl.getCanonicalLocales(locale).length === 1
    } catch {
      return false
    }
  }, 'must be a valid locale'),
  timezone: z.string().trim().refine(tz => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz })
      return true
    } catch {
      return false
    }
  }, 'must be a valid IANA timezone'),
  householdSize: z.coerce.number().int().min(1).max(50),
  starterPreset: z.enum(['blank', 'template']).default('blank'),
  createStarterBudget: z.boolean().default(false),
})

// ─── Budget ─────────────────────────────────────────────────────────────────

export const budgetQuerySchema = z.object({ year: year.optional() })

export const budgetSaveSchema = z.object({
  year,
  month,
  lines: z.array(z.object({
    categoryId: id,
    amount,
    notes: nullableText(500),
  })).max(500),
})

export const yearMonthParamsSchema = z.object({ year, month })

// ─── Categories ─────────────────────────────────────────────────────────────

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: hexColor,
  icon: nullableText(60),
})

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: hexColor.optional(),
  icon: nullableText(60).optional(),
  sortOrder: z.number().int().optional(),
  isIncome: z.boolean().optional(),
}).refine(atLeastOneField, 'No updatable fields were provided.')

// ─── Mapping rules ──────────────────────────────────────────────────────────

const matchType = z.enum(MATCH_TYPES)
const matchValue = z.string().trim().min(1).max(200)
const priority = z.number().int().min(0).max(10000)

export const mappingRulesQuerySchema = z.object({ categoryId: id.optional() })

export const mappingRuleCreateSchema = z.object({
  categoryId: id,
  matchType,
  matchValue,
  priority: priority.default(100),
  notes: nullableText(500),
}).refine(r => r.matchType !== 'regex' || isValidRegex(r.matchValue), {
  message: 'must be a valid regular expression',
  path: ['matchValue'],
})

export const mappingRuleUpdateSchema = z.object({
  categoryId: id.optional(),
  matchType: matchType.optional(),
  matchValue: matchValue.optional(),
  priority: priority.optional(),
  isActive: z.boolean().optional(),
  notes: nullableText(500).optional(),
}).refine(atLeastOneField, 'No updatable fields were provided.')

export const mappingRuleTestSchema = z.object({
  description: z.string().trim().min(1).max(500),
})

// ─── Transactions ───────────────────────────────────────────────────────────

export const transactionsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must use the YYYY-MM format').optional(),
  categoryId: id.optional(),
  search: z.string().trim().max(200).optional(),
  uncategorized: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

export const transactionCreateSchema = z.object({
  descripcion: z.string().trim().min(1).max(500),
  importe: amount,
  fechaInicio: dateTime,
  categoryId: id.nullish().transform(v => v ?? null),
  notes: nullableText(2000),
})

export const transactionUpdateSchema = z.object({
  descripcion: z.string().trim().min(1).max(500).optional(),
  importe: amount.optional(),
  fechaInicio: dateTime.optional(),
  categoryId: id.nullable().optional(),
  notes: nullableText(2000).optional(),
  excludeFromBudget: z.boolean().optional(),
  splitAnnual: z.boolean().optional(),
  state: z.string().trim().min(1).max(40).optional(),
  budgetDate: calendarDate.nullable().optional(),
})

export const bulkCategorizeSchema = z.object({
  description: z.string().min(1).max(500),
  categoryId: id,
})
