import type { Metadata } from 'next'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSettingsProvider } from '@/components/providers/AppSettingsProvider'
import { getPublicAppSettings } from '@/lib/app-settings'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicAppSettings()

  return {
    title: settings.appName,
    description: `${settings.householdName} budget workspace`,
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getPublicAppSettings()

  return (
    <html lang={settings.locale} suppressHydrationWarning>
      <body className="font-sans bg-background text-foreground antialiased">
        <AppSettingsProvider settings={settings}>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </AppSettingsProvider>
      </body>
    </html>
  )
}
