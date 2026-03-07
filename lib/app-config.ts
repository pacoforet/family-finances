export const DEFAULT_APP_NAME = 'Budget Starter'
export const DEFAULT_HOUSEHOLD_NAME = 'My Household'
export const DEFAULT_LOCALE = 'en-US'
export const DEFAULT_CURRENCY = 'USD'
export const DEFAULT_TIMEZONE = 'UTC'
export const DEFAULT_HOUSEHOLD_SIZE = 1

export const DEFAULT_SETTINGS = {
  appName: DEFAULT_APP_NAME,
  householdName: DEFAULT_HOUSEHOLD_NAME,
  defaultCurrency: DEFAULT_CURRENCY,
  locale: DEFAULT_LOCALE,
  timezone: DEFAULT_TIMEZONE,
  householdSize: DEFAULT_HOUSEHOLD_SIZE,
  setupCompleted: false,
} as const

export type PublicAppSettings = {
  appName: string
  householdName: string
  defaultCurrency: string
  locale: string
  timezone: string
  householdSize: number
  setupCompleted: boolean
}

export const LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
] as const

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD'] as const
