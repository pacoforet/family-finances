import type { MappingRule } from '@/db/schema'

export const MATCH_TYPES = ['contains', 'exact', 'starts_with', 'regex'] as const
export type MatchType = (typeof MATCH_TYPES)[number]

/**
 * Returns the stored form of a rule's match value. Plain-text rules are matched
 * case-insensitively, so they are stored lowercase; regex rules keep their case
 * because lowercasing changes meaning (`\D` → `\d`) and they already run with
 * the `i` flag.
 */
export function normalizeMatchValue(matchType: string, matchValue: string): string {
  return matchType === 'regex' ? matchValue : matchValue.toLowerCase()
}

/**
 * Builds a matcher for a set of rules. Rules are evaluated in priority order
 * (lowest number = highest priority); inactive rules and invalid regexes are
 * ignored. Regexes are compiled once, so the matcher is cheap to call for
 * every row of an import.
 */
export function createRuleMatcher(rules: MappingRule[]): (description: string) => MappingRule | null {
  const compiled = [...rules]
    .filter(r => r.isActive)
    .sort((a, b) => a.priority - b.priority)
    .flatMap(rule => {
      const val = rule.matchValue.toLowerCase()
      switch (rule.matchType) {
        case 'exact':
          return [{ rule, test: (desc: string) => desc === val }]
        case 'contains':
          return [{ rule, test: (desc: string) => desc.includes(val) }]
        case 'starts_with':
          return [{ rule, test: (desc: string) => desc.startsWith(val) }]
        case 'regex':
          try {
            const re = new RegExp(rule.matchValue, 'i')
            return [{ rule, test: (desc: string) => re.test(desc) }]
          } catch {
            return [] // Invalid regex — skip
          }
        default:
          return []
      }
    })

  return (description: string) => {
    const desc = description.toLowerCase().trim()
    return compiled.find(c => c.test(desc))?.rule ?? null
  }
}

/** Finds which rule would match a description. Useful for the "test rule" UI. */
export function findMatchingRule(description: string, rules: MappingRule[]): MappingRule | null {
  return createRuleMatcher(rules)(description)
}

/** Returns the categoryId of the first matching rule, or null. */
export function applyMappingRules(description: string, rules: MappingRule[]): string | null {
  return findMatchingRule(description, rules)?.categoryId ?? null
}
