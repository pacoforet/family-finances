import type { Metadata } from 'next'
import { Fraunces, Instrument_Sans } from 'next/font/google'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSettingsProvider } from '@/components/providers/AppSettingsProvider'
import { getPublicAppSettings } from '@/lib/app-settings'

export const dynamic = 'force-dynamic'

const display = Fraunces({
  subsets: ['latin', 'latin-ext'],
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-display-serif',
  display: 'swap',
})

const body = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
  display: 'swap',
})

// Applies the stored (or system) theme before first paint, so dark mode never flashes light.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`

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
    <html lang={settings.locale} suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-background text-foreground antialiased">
        <AppSettingsProvider settings={settings}>
          <TooltipProvider>
            {/* Above the paper-grain layer (body::before) */}
            <div className="relative z-[1]">{children}</div>
          </TooltipProvider>
        </AppSettingsProvider>
      </body>
    </html>
  )
}
