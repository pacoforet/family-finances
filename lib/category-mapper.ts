import type { MappingRule } from '@/db/schema'

/**
 * Applies mapping rules to a transaction description.
 * Rules are evaluated in priority order (lowest number = highest priority).
 * All matching is case-insensitive.
 * Returns categoryId of first matching rule, or null.
 */
export function applyMappingRules(
  description: string,
  rules: MappingRule[]
): string | null {
  const desc = description.toLowerCase().trim()

  const sorted = [...rules]
    .filter(r => r.isActive)
    .sort((a, b) => a.priority - b.priority)

  for (const rule of sorted) {
    const val = rule.matchValue.toLowerCase()
    let matched = false

    switch (rule.matchType) {
      case 'exact':
        matched = desc === val
        break
      case 'contains':
        matched = desc.includes(val)
        break
      case 'starts_with':
        matched = desc.startsWith(val)
        break
      case 'regex':
        try {
          matched = new RegExp(val, 'i').test(desc)
        } catch {
          // Invalid regex — skip
        }
        break
    }

    if (matched) return rule.categoryId
  }

  return null
}

/**
 * Finds which rule would match a given description.
 * Returns the matching rule or null. Useful for the "Probar regla" UI.
 */
export function findMatchingRule(
  description: string,
  rules: MappingRule[]
): MappingRule | null {
  const desc = description.toLowerCase().trim()

  const sorted = [...rules]
    .filter(r => r.isActive)
    .sort((a, b) => a.priority - b.priority)

  for (const rule of sorted) {
    const val = rule.matchValue.toLowerCase()
    let matched = false

    switch (rule.matchType) {
      case 'exact':
        matched = desc === val
        break
      case 'contains':
        matched = desc.includes(val)
        break
      case 'starts_with':
        matched = desc.startsWith(val)
        break
      case 'regex':
        try {
          matched = new RegExp(val, 'i').test(desc)
        } catch {
          // skip
        }
        break
    }

    if (matched) return rule
  }

  return null
}
