import { describe, expect, it } from 'vitest'
import type { MappingRule } from '@/db/schema'
import { applyMappingRules, createRuleMatcher, normalizeMatchValue } from './category-mapper'

function rule(overrides: Partial<MappingRule>): MappingRule {
  return {
    id: overrides.matchValue ?? 'r', categoryId: 'c', matchType: 'contains', matchValue: 'x',
    priority: 100, isActive: true, notes: null, createdAt: '', ...overrides,
  }
}

describe('createRuleMatcher', () => {
  it('matches case-insensitively by type', () => {
    const match = createRuleMatcher([
      rule({ matchType: 'exact', matchValue: 'netflix', categoryId: 'fun' }),
      rule({ matchType: 'starts_with', matchValue: 'uber', categoryId: 'transport' }),
      rule({ matchType: 'contains', matchValue: 'lidl', categoryId: 'food' }),
      rule({ matchType: 'regex', matchValue: '^AMZN\\s\\d+$', categoryId: 'shop' }),
    ])
    expect(match('  NETFLIX ')?.categoryId).toBe('fun')
    expect(match('Uber *Trip')?.categoryId).toBe('transport')
    expect(match('Compra LIDL Madrid')?.categoryId).toBe('food')
    expect(match('amzn 1234')?.categoryId).toBe('shop')
    expect(match('something else')).toBeNull()
  })

  it('respects priority and skips inactive rules and invalid regexes', () => {
    const match = createRuleMatcher([
      rule({ matchValue: 'shop', categoryId: 'low', priority: 50 }),
      rule({ matchValue: 'shop', categoryId: 'high', priority: 10 }),
      rule({ matchValue: 'shop', categoryId: 'inactive', priority: 1, isActive: false }),
      rule({ matchType: 'regex', matchValue: '([', categoryId: 'broken', priority: 0 }),
    ])
    expect(match('shop')?.categoryId).toBe('high')
  })

  it('keeps regex case-sensitive tokens like \\D intact', () => {
    expect(normalizeMatchValue('regex', '\\D+')).toBe('\\D+')
    expect(normalizeMatchValue('contains', 'LIDL')).toBe('lidl')
    expect(applyMappingRules('abc', [rule({ matchType: 'regex', matchValue: '^\\D+$', categoryId: 'letters' })])).toBe('letters')
    expect(applyMappingRules('123', [rule({ matchType: 'regex', matchValue: '^\\D+$', categoryId: 'letters' })])).toBeNull()
  })
})
