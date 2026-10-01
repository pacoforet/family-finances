import type { MappingRule } from '@/db/schema'
import { createRuleMatcher } from '@/lib/category-mapper'

/**
 * Smart categorizer: explicit rules first, then what the household has taught
 * the app by categorizing transactions themselves.
 *
 *  1. Rule        - an explicit mapping rule matched (the user's own instruction).
 *  2. Merchant    - the same normalized merchant was labeled before. Examples are
 *                   weighted by how close their amount is, so "Transferencia de
 *                   PACO 1550 €" (monthly contribution) and "… 50 €" (extra) learn
 *                   different categories from the same description.
 *  3. Similar     - no exact merchant, but a known one is textually close
 *                   ("Carrefour Express" ~ "Carrefour", "Nàutic Tamariu Bar").
 *
 * Every prediction carries a calibrated confidence; callers auto-apply above
 * AUTO_APPLY_CONFIDENCE and surface the rest as suggestions to review.
 */

/** Label used for transactions the household excludes from the budget. */
export const EXCLUDE_LABEL = '__exclude__'

export const AUTO_APPLY_CONFIDENCE = 0.6
export const SUGGEST_CONFIDENCE = 0.35

export interface LabeledTransaction {
  descripcion: string
  importe: number
  categoryId: string | null
  excludeFromBudget: boolean
}

export interface CategoryPrediction {
  /** Category to assign, or null (no guess, or an exclusion). */
  categoryId: string | null
  /** True when the transaction should be excluded from the budget. */
  exclude: boolean
  confidence: number
  source: 'rule' | 'merchant' | 'similar' | 'none'
  /** Short Spanish explanation shown to the user. */
  reason: string
}

const LEGAL_AND_STOP_TOKENS = new Set([
  'sl', 'slu', 'sa', 'sau', 'sll', 'scp', 'cb', 'efc', 'e', 'f', 'c', 'u', 'l', 's',
  'de', 'del', 'la', 'el', 'les', 'los', 'las', 'i', 'y', 'd', 'en', 'a', 'al',
])

/**
 * Canonical merchant key: accent-free, lowercase, without card suffixes
 * (`*7238`), reference numbers, punctuation or legal-form tokens.
 * "Generali Seg. Y Reaseg, S.a.u." -> "generali seg reaseg".
 */
export function normalizeMerchant(description: string): string {
  return description
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\*\s*\d+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(token => token && !/^\d+$/.test(token) && !LEGAL_AND_STOP_TOKENS.has(token))
    .join(' ')
}

function trigrams(key: string): Set<string> {
  const padded = `  ${key} `
  const grams = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3))
  return grams
}

/** Dice coefficient over character trigrams, 0..1. */
export function merchantSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const ga = trigrams(a)
  const gb = trigrams(b)
  let shared = 0
  for (const g of ga) if (gb.has(g)) shared++
  return (2 * shared) / (ga.size + gb.size)
}

interface Example {
  label: string
  amount: number
}

interface MerchantStats {
  key: string
  examples: Example[]
  grams: Set<string>
}

export interface CategorizerModel {
  merchants: Map<string, MerchantStats>
  match: ReturnType<typeof createRuleMatcher>
  categoryNames: Map<string, string>
}

function labelOf(tx: LabeledTransaction): string | null {
  if (tx.excludeFromBudget) return EXCLUDE_LABEL
  return tx.categoryId
}

export function buildCategorizer(
  history: LabeledTransaction[],
  rules: MappingRule[],
  categoryNames: Map<string, string> = new Map(),
): CategorizerModel {
  const merchants = new Map<string, MerchantStats>()
  for (const tx of history) {
    const label = labelOf(tx)
    if (!label) continue
    const key = normalizeMerchant(tx.descripcion)
    if (!key) continue
    let stats = merchants.get(key)
    if (!stats) {
      stats = { key, examples: [], grams: trigrams(key) }
      merchants.set(key, stats)
    }
    stats.examples.push({ label, amount: tx.importe })
  }
  return { merchants, match: createRuleMatcher(rules), categoryNames }
}

/** Learns from one more confirmed transaction without rebuilding the model. */
export function learn(model: CategorizerModel, tx: LabeledTransaction) {
  const label = labelOf(tx)
  const key = normalizeMerchant(tx.descripcion)
  if (!label || !key) return
  let stats = model.merchants.get(key)
  if (!stats) {
    stats = { key, examples: [], grams: trigrams(key) }
    model.merchants.set(key, stats)
  }
  stats.examples.push({ label, amount: tx.importe })
}

/**
 * Weighted vote among a merchant's examples with the same sign. The weight
 * decays with the log-ratio of amounts: 1550 vs 1520 counts fully, 1550 vs 50
 * barely at all.
 */
function vote(examples: Example[], amount: number) {
  const sameSign = examples.filter(e => Math.sign(e.amount) === Math.sign(amount) || amount === 0)
  if (sameSign.length === 0) return null
  const scores = new Map<string, number>()
  let total = 0
  const logAmount = Math.log(Math.abs(amount) + 1)
  for (const e of sameSign) {
    const distance = Math.abs(Math.log(Math.abs(e.amount) + 1) - logAmount)
    const weight = Math.exp(-2 * distance)
    scores.set(e.label, (scores.get(e.label) ?? 0) + weight)
    total += weight
  }
  let best: string | null = null
  let bestScore = 0
  for (const [label, score] of scores) {
    if (score > bestScore) { best = label; bestScore = score }
  }
  if (!best || total === 0) return null
  const share = bestScore / total
  // Evidence-weighted: one example is a hint, several consistent ones are a habit.
  const evidence = total / (total + 0.6)
  return { label: best, confidence: share * evidence, count: sameSign.length }
}

function toPrediction(
  model: CategorizerModel,
  label: string,
  confidence: number,
  source: CategoryPrediction['source'],
  reason: string,
): CategoryPrediction {
  const exclude = label === EXCLUDE_LABEL
  return {
    categoryId: exclude ? null : label,
    exclude,
    confidence: Math.round(confidence * 100) / 100,
    source,
    reason,
  }
}

const NO_PREDICTION: CategoryPrediction = {
  categoryId: null, exclude: false, confidence: 0, source: 'none', reason: 'Sin datos suficientes',
}

export function predictCategory(
  model: CategorizerModel,
  tx: { descripcion: string; importe: number },
): CategoryPrediction {
  // 1. Explicit rules always win: they are the household's own instructions.
  const rule = model.match(tx.descripcion)
  if (rule) {
    return toPrediction(model, rule.categoryId, 0.99, 'rule', `Regla «${rule.matchValue}»`)
  }

  const key = normalizeMerchant(tx.descripcion)
  if (!key) return NO_PREDICTION

  // 2. Same merchant seen before
  const known = model.merchants.get(key)
  if (known) {
    const result = vote(known.examples, tx.importe)
    if (result) {
      const name = model.categoryNames.get(result.label)
      const what = result.label === EXCLUDE_LABEL ? 'excluido' : `«${name ?? 'categoría'}»`
      return toPrediction(model, result.label, result.confidence, 'merchant',
        `${result.count} movimiento${result.count === 1 ? '' : 's'} de este comercio ${result.count === 1 ? 'fue' : 'fueron'} ${what}`)
    }
  }

  // 3. A textually similar merchant
  let bestMatch: { stats: MerchantStats; similarity: number } | null = null
  for (const stats of model.merchants.values()) {
    const similarity = merchantSimilarity(key, stats.key)
    if (similarity >= 0.55 && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { stats, similarity }
    }
  }
  if (bestMatch) {
    const result = vote(bestMatch.stats.examples, tx.importe)
    if (result) {
      return toPrediction(model, result.label, result.confidence * bestMatch.similarity * 0.9, 'similar',
        `Parecido a «${bestMatch.stats.key}»`)
    }
  }

  return NO_PREDICTION
}
