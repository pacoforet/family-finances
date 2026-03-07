import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/db'
import { appSettings, budgetLines, categories, mappingRules } from '@/db/schema'
import { APP_SETTINGS_ID, getPublicAppSettings } from '@/lib/app-settings'
import {
  buildTemplateCategories,
  isBudgetTemplateCategory,
  STARTER_CATEGORIES,
  STARTER_RULES,
  type StarterPreset,
} from '@/lib/starter-template'

function normalizeBody(body: Record<string, unknown>) {
  return {
    appName: String(body.appName ?? '').trim(),
    householdName: String(body.householdName ?? '').trim(),
    defaultCurrency: String(body.defaultCurrency ?? '').trim().toUpperCase(),
    locale: String(body.locale ?? '').trim(),
    timezone: String(body.timezone ?? '').trim(),
    householdSize: Number(body.householdSize ?? 1),
    starterPreset: String(body.starterPreset ?? 'blank') as StarterPreset,
    createStarterBudget: Boolean(body.createStarterBudget),
  }
}

export async function GET() {
  const settings = await getPublicAppSettings()
  return NextResponse.json({ settings })
}

export async function PUT(request: NextRequest) {
  const body = normalizeBody(await request.json())

  if (!body.appName || !body.householdName || !body.defaultCurrency || !body.locale || !body.timezone) {
    return NextResponse.json({ error: 'All setup fields are required.' }, { status: 400 })
  }

  if (!Number.isFinite(body.householdSize) || body.householdSize < 1) {
    return NextResponse.json({ error: 'Household size must be at least 1.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const existingSettings = await db.select().from(appSettings).limit(1)
  const settingsRow = {
    id: APP_SETTINGS_ID,
    appName: body.appName,
    householdName: body.householdName,
    defaultCurrency: body.defaultCurrency,
    locale: body.locale,
    timezone: body.timezone,
    householdSize: Math.trunc(body.householdSize),
    setupCompleted: true,
    createdAt: existingSettings[0]?.createdAt ?? now,
    updatedAt: now,
  }

  await db.transaction(async (tx) => {
    if (existingSettings[0]) {
      await tx.update(appSettings).set(settingsRow).where(eq(appSettings.id, existingSettings[0].id))
    } else {
      await tx.insert(appSettings).values(settingsRow)
    }

    const existingCategories = await tx.select().from(categories)
    const hasNonIncomeCategories = existingCategories.some((category) => !category.isIncome)

    if (!hasNonIncomeCategories && body.starterPreset === 'template') {
      const starterCategories = buildTemplateCategories(now)
      await tx.insert(categories).values(starterCategories)

      const categoryIds = new Map(starterCategories.map((category) => [category.name, category.id]))

      if (body.createStarterBudget) {
        const currentDate = new Date()
        const year = currentDate.getUTCFullYear()
        const month = currentDate.getUTCMonth() + 1

        await tx.insert(budgetLines).values(
          STARTER_CATEGORIES
            .filter(isBudgetTemplateCategory)
            .map((category) => ({
              id: uuidv4(),
              categoryId: categoryIds.get(category.name)!,
              year,
              month,
              amount: category.defaultBudget,
              notes: null,
            }))
        )
      }

      await tx.insert(mappingRules).values(
        STARTER_RULES.map((rule) => ({
          id: uuidv4(),
          categoryId: categoryIds.get(rule.categoryName)!,
          matchType: rule.matchType,
          matchValue: rule.matchValue,
          priority: rule.priority,
          isActive: true,
          notes: null,
          createdAt: now,
        }))
      )
    }
  })

  const settings = await getPublicAppSettings()
  return NextResponse.json({ settings })
}
