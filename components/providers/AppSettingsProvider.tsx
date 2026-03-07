'use client'

import { createContext, useContext, useEffect } from 'react'
import { configureFormatting } from '@/lib/format'
import type { PublicAppSettings } from '@/lib/app-config'

const AppSettingsContext = createContext<PublicAppSettings | null>(null)

export function AppSettingsProvider({
  children,
  settings,
}: {
  children: React.ReactNode
  settings: PublicAppSettings
}) {
  useEffect(() => {
    configureFormatting({
      locale: settings.locale,
      currency: settings.defaultCurrency,
      timezone: settings.timezone,
    })
  }, [settings.defaultCurrency, settings.locale, settings.timezone])

  return (
    <AppSettingsContext.Provider value={settings}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const settings = useContext(AppSettingsContext)

  if (!settings) {
    throw new Error('useAppSettings must be used within AppSettingsProvider')
  }

  return settings
}
