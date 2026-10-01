import { describe, expect, it } from 'vitest'
import type { MappingRule } from '@/db/schema'
import {
  AUTO_APPLY_CONFIDENCE, buildCategorizer, learn, merchantSimilarity, normalizeMerchant, predictCategory,
  type LabeledTransaction,
} from './categorizer'

const tx = (descripcion: string, importe: number, categoryId: string | null, excludeFromBudget = false): LabeledTransaction =>
  ({ descripcion, importe, categoryId, excludeFromBudget })

describe('normalizeMerchant', () => {
  it('drops accents, card suffixes, numbers and legal forms', () => {
    expect(normalizeMerchant('Generali Seg. Y Reaseg, S.a.u.')).toBe('generali seg reaseg')
    expect(normalizeMerchant('Una recarga de Apple Pay con *7238')).toBe('una recarga apple pay con')
    expect(normalizeMerchant('Nàutic Tamariu')).toBe('nautic tamariu')
    expect(normalizeMerchant('Lm 239 S.b. De Trajana')).toBe('lm b trajana')
  })

  it('scores near-identical merchants as similar', () => {
    expect(merchantSimilarity('carrefour express', 'carrefour')).toBeGreaterThan(0.55)
    expect(merchantSimilarity('carrefour', 'repsol')).toBeLessThan(0.2)
  })
})

describe('predictCategory', () => {
  const history = [
    tx('Transferencia de PACO FORET ARMADANS', 1520, 'monthly'),
    tx('Transferencia de PACO FORET ARMADANS', 1550, 'monthly'),
    tx('Transferencia de PACO FORET ARMADANS', 50, 'extra'),
    tx('Transferencia de PACO FORET ARMADANS', 100, 'extra'),
    tx('Transferencia a PACO FORET ARMADANS', -500, 'cleaning'),
    tx('Transferencia a PACO FORET ARMADANS', -100, 'debt'),
    tx('A EUR Cuenta Remunerada', -50, null, true),
    tx('A EUR Cuenta Remunerada', -50, null, true),
    tx('Carrefour', -12, 'food'),
    tx('Carrefour', -30, 'food'),
  ]
  const model = buildCategorizer(history, [])

  it('uses the amount to tell apart uses of the same counterparty', () => {
    expect(predictCategory(model, { descripcion: 'Transferencia de PACO FORET ARMADANS', importe: 1550 }).categoryId).toBe('monthly')
    expect(predictCategory(model, { descripcion: 'Transferencia de PACO FORET ARMADANS', importe: 60 }).categoryId).toBe('extra')
    expect(predictCategory(model, { descripcion: 'Transferencia a PACO FORET ARMADANS', importe: -500 }).categoryId).toBe('cleaning')
    expect(predictCategory(model, { descripcion: 'Transferencia a PACO FORET ARMADANS', importe: -100 }).categoryId).toBe('debt')
  })

  it('learns exclusions', () => {
    const p = predictCategory(model, { descripcion: 'A EUR Cuenta Remunerada', importe: -50 })
    expect(p).toMatchObject({ exclude: true, categoryId: null, source: 'merchant' })
    expect(p.confidence).toBeGreaterThanOrEqual(AUTO_APPLY_CONFIDENCE)
  })

  it('recognizes variants of a known merchant with lower confidence', () => {
    const p = predictCategory(model, { descripcion: 'Carrefour Express', importe: -14.17 })
    expect(p).toMatchObject({ categoryId: 'food', source: 'similar' })
    expect(p.confidence).toBeLessThan(predictCategory(model, { descripcion: 'Carrefour', importe: -14 }).confidence)
  })

  it('lets explicit rules win and returns nothing for unknown merchants', () => {
    const rules: MappingRule[] = [{ id: 'r', categoryId: 'fuel', matchType: 'contains', matchValue: 'carrefour', priority: 1, isActive: true, notes: null, createdAt: '' }]
    const withRules = buildCategorizer(history, rules)
    expect(predictCategory(withRules, { descripcion: 'Carrefour', importe: -12 })).toMatchObject({ categoryId: 'fuel', source: 'rule' })
    expect(predictCategory(model, { descripcion: 'Totally New Shop', importe: -9 })).toMatchObject({ categoryId: null, source: 'none', confidence: 0 })
  })

  it('never predicts from examples of the opposite sign', () => {
    const m = buildCategorizer([tx('Amazon', -30, 'shopping')], [])
    expect(predictCategory(m, { descripcion: 'Amazon', importe: 30 }).source).toBe('none')
    learn(m, tx('Amazon', 30, 'refund'))
    expect(predictCategory(m, { descripcion: 'Amazon', importe: 25 }).categoryId).toBe('refund')
  })
})
