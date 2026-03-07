import { v4 as uuidv4 } from 'uuid'

export type StarterPreset = 'blank' | 'template'

export const STARTER_CATEGORIES = [
  { name: 'Housing', color: '#2563EB', icon: 'home', sortOrder: 1, defaultBudget: 1800 },
  { name: 'Utilities', color: '#0F766E', icon: 'zap', sortOrder: 2, defaultBudget: 300 },
  { name: 'Groceries', color: '#16A34A', icon: 'shopping-cart', sortOrder: 3, defaultBudget: 600 },
  { name: 'Transport', color: '#EA580C', icon: 'car', sortOrder: 4, defaultBudget: 250 },
  { name: 'Health', color: '#DC2626', icon: 'heart-pulse', sortOrder: 5, defaultBudget: 200 },
  { name: 'Entertainment', color: '#7C3AED', icon: 'party-popper', sortOrder: 6, defaultBudget: 180 },
  { name: 'Shopping', color: '#DB2777', icon: 'shopping-bag', sortOrder: 7, defaultBudget: 150 },
  { name: 'Travel', color: '#0891B2', icon: 'plane', sortOrder: 8, defaultBudget: 125 },
  { name: 'Savings', color: '#65A30D', icon: 'piggy-bank', sortOrder: 9, defaultBudget: 400 },
  { name: 'Salary', color: '#059669', icon: 'banknote', sortOrder: 10, isIncome: true },
] as const

export const STARTER_RULES = [
  { categoryName: 'Entertainment', matchType: 'contains', matchValue: 'netflix', priority: 20 },
  { categoryName: 'Entertainment', matchType: 'contains', matchValue: 'spotify', priority: 20 },
  { categoryName: 'Transport', matchType: 'contains', matchValue: 'uber', priority: 20 },
  { categoryName: 'Transport', matchType: 'contains', matchValue: 'shell', priority: 25 },
  { categoryName: 'Groceries', matchType: 'contains', matchValue: 'aldi', priority: 20 },
  { categoryName: 'Groceries', matchType: 'contains', matchValue: 'lidl', priority: 20 },
  { categoryName: 'Shopping', matchType: 'contains', matchValue: 'amazon', priority: 30 },
] as const

export function isBudgetTemplateCategory(
  category: (typeof STARTER_CATEGORIES)[number]
): category is Extract<(typeof STARTER_CATEGORIES)[number], { defaultBudget: number }> {
  return 'defaultBudget' in category
}

export function buildTemplateCategories(now: string) {
  return STARTER_CATEGORIES.map((category) => ({
    id: uuidv4(),
    name: category.name,
    color: category.color,
    icon: category.icon,
    sortOrder: category.sortOrder,
    isIncome: 'isIncome' in category ? Boolean(category.isIncome) : false,
    createdAt: now,
  }))
}
