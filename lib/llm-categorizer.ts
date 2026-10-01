import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod/v4'

/**
 * Optional last step of auto-categorization: asks Claude to classify merchants
 * the household has never categorized before (a new restaurant, a shop on a
 * trip), using its general knowledge plus examples of how this household
 * categorizes. Results are only ever stored as suggestions to review.
 *
 * Enabled only when ANTHROPIC_API_KEY is set. Only merchant descriptions,
 * amounts and category names are sent - no balances, dates or account data.
 */

export function isLlmCategorizationEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export interface LlmCategoryOption {
  id: string
  name: string
  isIncome: boolean
}

export interface LlmItem {
  id: string
  descripcion: string
  importe: number
}

export interface LlmSuggestion {
  id: string
  categoryId: string | null
  exclude: boolean
  confidence: number
  reason: string
}

const MODEL = 'claude-opus-5-5'
const BATCH_SIZE = 60

const ResultSchema = z.object({
  results: z.array(z.object({
    index: z.number().int(),
    category: z.string().describe('Exact category name from the list, or "" when unsure'),
    exclude: z.boolean().describe('True for internal transfers between own accounts that are neither income nor spending'),
    confidence: z.enum(['alta', 'media', 'baja']),
    reason: z.string().describe('Very short reason in Spanish, max 12 words'),
  })),
})

const CONFIDENCE = { alta: 0.8, media: 0.6, baja: 0.4 } as const

const SYSTEM = `Categorizas movimientos bancarios de una familia en España para su app de presupuesto.
Para cada movimiento, elige UNA categoría de la lista usando el nombre exacto, siguiendo cómo la familia ya categoriza (ver ejemplos).
- Gastos (importe negativo) solo van a categorías de gasto; ingresos (positivo) a categorías de ingreso, salvo devoluciones de un comercio, que van a la categoría del gasto original.
- Usa tu conocimiento de comercios y lugares de España (restaurantes, supermercados, gasolineras, parkings, farmacias...).
- Si no reconoces el comercio y no hay pistas claras, deja la categoría vacía y confianza "baja". No inventes.`

/** Classifies unfamiliar merchants with Claude. Returns one suggestion per confident result. */
export async function suggestWithClaude(
  items: LlmItem[],
  categories: LlmCategoryOption[],
  examples: Array<{ descripcion: string; category: string }>,
): Promise<LlmSuggestion[]> {
  if (!isLlmCategorizationEnabled() || items.length === 0) return []

  const client = new Anthropic()
  const byName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
  const categoryList = categories
    .map(c => `- ${c.name} (${c.isIncome ? 'ingreso' : 'gasto'})`)
    .join('\n')
  const exampleList = examples.slice(0, 120).map(e => `- ${e.descripcion} → ${e.category}`).join('\n')

  const suggestions: LlmSuggestion[] = []
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE)
    const lines = batch.map((item, i) => `${i}. ${item.descripcion} | ${item.importe.toFixed(2)} €`).join('\n')

    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Server-side refusal fallback: a declined request is retried on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(ResultSchema) },
      system: [{ type: 'text', text: `${SYSTEM}\n\nCategorías:\n${categoryList}\n\nEjemplos de esta familia:\n${exampleList}`, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `Movimientos:\n${lines}` }],
    })

    if (response.stop_reason === 'refusal' || !response.parsed_output) continue

    for (const result of response.parsed_output.results) {
      const item = batch[result.index]
      if (!item) continue
      const categoryId = byName.get(result.category.trim().toLowerCase()) ?? null
      if (!categoryId && !result.exclude) continue
      suggestions.push({
        id: item.id,
        categoryId,
        exclude: result.exclude && !categoryId,
        confidence: CONFIDENCE[result.confidence],
        reason: `Claude: ${result.reason}`,
      })
    }
  }
  return suggestions
}
