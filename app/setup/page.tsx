'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENCY_OPTIONS, LOCALE_OPTIONS } from '@/lib/app-config'

const STARTER_OPTIONS = [
  {
    value: 'blank',
    title: 'Start blank',
    description: 'No categories, no budgets, and no starter rules.',
  },
  {
    value: 'template',
    title: 'Use starter template',
    description: 'Create common categories and a few starter categorization rules.',
  },
] as const

export default function SetupPage() {
  const router = useRouter()
  const guessedTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    []
  )

  const [appName, setAppName] = useState('Budget Starter')
  const [householdName, setHouseholdName] = useState('My Household')
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [locale, setLocale] = useState('en-US')
  const [timezone, setTimezone] = useState(guessedTimezone)
  const [householdSize, setHouseholdSize] = useState('2')
  const [starterPreset, setStarterPreset] = useState<'blank' | 'template'>('template')
  const [createStarterBudget, setCreateStarterBudget] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/app-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName,
          householdName,
          defaultCurrency,
          locale,
          timezone,
          householdSize: Number(householdSize),
          starterPreset,
          createStarterBudget,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Unable to save setup.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Unable to save setup.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-700">
              First-run setup
            </p>
            <div className="space-y-3">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-900">
                Configure your own household budget workspace.
              </h1>
              <p className="max-w-xl text-base text-slate-600">
                This starter is designed for one household per deployment. Choose your defaults,
                then decide whether you want a blank app or a prebuilt budget template.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {STARTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStarterPreset(option.value)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    starterPreset === option.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium text-slate-900">{option.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Workspace details</CardTitle>
              <CardDescription>
                These values control branding, formatting, and starter content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="app-name">App name</Label>
                  <Input id="app-name" value={appName} onChange={(event) => setAppName(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="household-name">Household name</Label>
                  <Input
                    id="household-name"
                    value={householdName}
                    onChange={(event) => setHouseholdName(event.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Locale</Label>
                    <Select value={locale} onValueChange={setLocale}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Default currency</Label>
                    <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      placeholder="Europe/Madrid"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="household-size">Household size</Label>
                    <Input
                      id="household-size"
                      type="number"
                      min="1"
                      value={householdSize}
                      onChange={(event) => setHouseholdSize(event.target.value)}
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={createStarterBudget}
                    onChange={(event) => setCreateStarterBudget(event.target.checked)}
                    disabled={starterPreset === 'blank'}
                  />
                  <span>
                    Create starter monthly budgets for the current month.
                  </span>
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? 'Saving setup...' : 'Finish setup'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
