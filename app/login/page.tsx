'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { useUiCopy } from '@/lib/ui-copy'
import { householdMonogram } from '@/components/layout/NavPanel'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const settings = useAppSettings()
  const copy = useUiCopy()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(copy.login.invalidCredentials)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      {/* Brand panel: the same dark spine as the app sidebar */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground md:flex">
        <span className="font-display grid size-14 place-items-center rounded-full border border-sidebar-primary/50 text-[18px] italic text-sidebar-primary">
          {householdMonogram(settings.householdName)}
        </span>
        <div className="animate-rise space-y-4">
          <p className="eyebrow text-sidebar-primary/80">{settings.householdName}</p>
          <p className="font-display max-w-md text-[44px] leading-[1.05] text-sidebar-accent-foreground">
            {settings.appName}
          </p>
        </div>
        {/* Ledger rules */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 31px, var(--sidebar-primary) 31px 32px)' }} />
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="animate-rise w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <span className="font-display mb-6 grid size-12 place-items-center rounded-full bg-primary text-[15px] italic text-primary-foreground md:hidden">
              {householdMonogram(settings.householdName)}
            </span>
            <h1 className="font-display text-[34px] leading-tight">{copy.login.signIn}</h1>
            <p className="text-sm text-muted-foreground">{copy.login.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              autoFocus
            />
            <Input
              type="password"
              placeholder={copy.login.password}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />

            {error && <p className="text-sm text-negative" role="alert">{error}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={!email || !password || loading}>
              {loading ? copy.login.signingIn : copy.login.signIn}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
