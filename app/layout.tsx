import type { Metadata } from 'next'
import './globals.css'
import { ConditionalSidebar } from '@/components/layout/ConditionalSidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSettingsProvider } from '@/components/providers/AppSettingsProvider'
import { SetupGate } from '@/components/layout/SetupGate'
import { getPublicAppSettings } from '@/lib/app-settings'

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
            <SetupGate>
              <div className="flex min-h-screen">
                <ConditionalSidebar />
                <main className="flex-1 overflow-auto">
                  {children}
                </main>
              </div>
            </SetupGate>
          </TooltipProvider>
        </AppSettingsProvider>
      </body>
    </html>
  )
}
