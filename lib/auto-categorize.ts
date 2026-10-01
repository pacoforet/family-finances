import { and, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, mappingRules, transactions } from '@/db/schema'
import {
  AUTO_APPLY_CONFIDENCE, buildCategorizer, predictCategory, SUGGEST_CONFIDENCE,
  type CategorizerModel, type CategoryPrediction,
} from '@/lib/categorizer'
import { isLlmCategorizationEnabled, suggestWithClaude } from '@/lib/llm-categorizer'

/**
 * Server side of auto-categorization: builds the model from everything the
 * household has categorized (or excluded) and applies it to new transactions.
 */

const REVERTED = ['DEVUELTO', 'REVERTED', 'REVERTIDO']

export async function loadCategorizer(): Promise<CategorizerModel> {
  const [rules, cats, history] = await Promise.all([
    db.select().from(mappingRules),
    db.select({ id: categories.id, name: categories.name }).from(categories),
    db.select({
      descripcion: transactions.descripcion,
      importe: transactions.importe,
      categoryId: transactions.categoryId,
      excludeFromBudget: transactions.excludeFromBudget,
    })
      .from(transactions)
      .where(and(
        or(sql`${transactions.categoryId} IS NOT NULL`, eq(transactions.excludeFromBudget, true)),
        or(isNull(transactions.state), notInArray(transactions.state, REVERTED)),
      )),
  ])
  return buildCategorizer(history, rules, new Map(cats.map(c => [c.id, c.name])))
}

/** Columns to write for a prediction: applied directly, stored as a suggestion, or nothing. */
export function categorizationFields(prediction: CategoryPrediction) {
  const hasAnswer = prediction.categoryId !== null || prediction.exclude
  if (hasAnswer && prediction.confidence >= AUTO_APPLY_CONFIDENCE) {
    return {
      categoryId: prediction.categoryId,
      excludeFromBudget: prediction.exclude,
      categorySource: prediction.source === 'rule' ? 'auto_rule' : 'learned',
      ...clearedSuggestion,
    }
  }
  if (hasAnswer && prediction.confidence >= SUGGEST_CONFIDENCE) {
    return {
      suggestedCategoryId: prediction.categoryId,
      suggestedExclude: prediction.exclude,
      suggestionConfidence: prediction.confidence,
      suggestionSource: prediction.source,
      suggestionReason: prediction.reason,
    }
  }
  return {}
}

export const clearedSuggestion = {
  suggestedCategoryId: null,
  suggestedExclude: false,
  suggestionConfidence: null,
  suggestionSource: null,
  suggestionReason: null,
}

/**
 * Re-runs the categorizer over uncategorized, non-excluded transactions that
 * have no pending or dismissed suggestion. With `useLlm`, merchants the model
 * cannot place are sent to Claude for suggestions.
 */
export async function categorizePending({ useLlm = false } = {}) {
  const model = await loadCategorizer()
  const pending = await db
    .select({ id: transactions.id, descripcion: transactions.descripcion, importe: transactions.importe })
    .from(transactions)
    .where(and(
      isNull(transactions.categoryId),
      eq(transactions.excludeFromBudget, false),
      or(isNull(transactions.suggestionSource), sql`${transactions.suggestionSource} NOT IN ('dismissed')`),
    ))

  let applied = 0
  let suggested = 0
  const unknown: typeof pending = []
  const now = new Date().toISOString()

  for (const tx of pending) {
    const fields = categorizationFields(predictCategory(model, tx))
    if ('categorySource' in fields) applied++
    else if ('suggestionSource' in fields) suggested++
    else { unknown.push(tx); continue }
    await db.update(transactions).set({ ...fields, updatedAt: now }).where(eq(transactions.id, tx.id))
  }

  let llmSuggested = 0
  if (useLlm && isLlmCategorizationEnabled() && unknown.length > 0) {
    const [cats, examples] = await Promise.all([
      db.select({ id: categories.id, name: categories.name, isIncome: categories.isIncome }).from(categories),
      db.selectDistinct({ descripcion: transactions.descripcion, category: categories.name })
        .from(transactions)
        .innerJoin(categories, eq(categories.id, transactions.categoryId))
        .where(inArray(transactions.categorySource, ['manual', 'auto_rule']))
        .limit(200),
    ])
    const suggestions = await suggestWithClaude(unknown, cats, examples)
    for (const s of suggestions) {
      await db.update(transactions).set({
        suggestedCategoryId: s.categoryId,
        suggestedExclude: s.exclude,
        suggestionConfidence: s.confidence,
        suggestionSource: 'llm',
        suggestionReason: s.reason,
        updatedAt: now,
      }).where(eq(transactions.id, s.id))
    }
    llmSuggested = suggestions.length
  }

  return { scanned: pending.length, applied, suggested: suggested + llmSuggested, llmSuggested, unresolved: unknown.length - llmSuggested }
}
