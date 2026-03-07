'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'

const PUBLIC_PATHS = new Set(['/login'])

export function SetupGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const settings = useAppSettings()

  useEffect(() => {
    if (!pathname || PUBLIC_PATHS.has(pathname)) {
      return
    }

    if (!settings.setupCompleted && pathname !== '/setup') {
      router.replace('/setup')
      return
    }

    if (settings.setupCompleted && pathname === '/setup') {
      router.replace('/dashboard')
    }
  }, [pathname, router, settings.setupCompleted])

  if (!PUBLIC_PATHS.has(pathname) && !settings.setupCompleted && pathname !== '/setup') {
    return <div className="min-h-screen" />
  }

  if (settings.setupCompleted && pathname === '/setup') {
    return <div className="min-h-screen" />
  }

  return <>{children}</>
}
