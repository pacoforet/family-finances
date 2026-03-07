import { db } from '@/db'
import { appSettings, type AppSettings } from '@/db/schema'
import {
  DEFAULT_APP_NAME,
  DEFAULT_CURRENCY,
  DEFAULT_HOUSEHOLD_NAME,
  DEFAULT_HOUSEHOLD_SIZE,
  DEFAULT_LOCALE,
  DEFAULT_SETTINGS,
  DEFAULT_TIMEZONE,
  type PublicAppSettings,
} from './app-config'

export const APP_SETTINGS_ID = 'default'

export async function getStoredAppSettings(): Promise<AppSettings | null> {
  try {
    const rows = await db.select().from(appSettings).limit(1)
    return rows[0] ?? null
  } catch {
    return null
  }
}

export async function getPublicAppSettings(): Promise<PublicAppSettings> {
  const settings = await getStoredAppSettings()

  return {
    appName: settings?.appName ?? DEFAULT_APP_NAME,
    householdName: settings?.householdName ?? DEFAULT_HOUSEHOLD_NAME,
    defaultCurrency: settings?.defaultCurrency ?? DEFAULT_CURRENCY,
    locale: settings?.locale ?? DEFAULT_LOCALE,
    timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
    householdSize: settings?.householdSize ?? DEFAULT_HOUSEHOLD_SIZE,
    setupCompleted: settings?.setupCompleted ?? DEFAULT_SETTINGS.setupCompleted,
  }
}
