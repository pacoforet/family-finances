'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENCY_OPTIONS, DEFAULT_APP_NAME, DEFAULT_HOUSEHOLD_NAME, LOCALE_OPTIONS } from '@/lib/app-config'
import { getUiCopy } from '@/lib/ui-copy'

const STARTER_OPTIONS = [
  { value: 'blank' },
  { value: 'template' },
] as const

export default function SetupPage() {
  const router = useRouter()
  const guessedTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    []
  )

  const [appName, setAppName] = useState(DEFAULT_APP_NAME)
  const [householdName, setHouseholdName] = useState(DEFAULT_HOUSEHOLD_NAME)
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [locale, setLocale] = useState('en-US')
  const copy = getUiCopy(locale)
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
        setError(data.error ?? copy.setup.saveError)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError(copy.setup.saveError)
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
              {copy.setup.eyebrow}
            </p>
            <div className="space-y-3">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-900">
                {copy.setup.title}
              </h1>
              <p className="max-w-xl text-base text-slate-600">
                {copy.setup.body}
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
                  <p className="font-medium text-slate-900">
                    {option.value === 'blank' ? copy.setup.startBlank : copy.setup.starterTemplate}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {option.value === 'blank'
                      ? copy.setup.startBlankDescription
                      : copy.setup.starterTemplateDescription}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>{copy.setup.detailsTitle}</CardTitle>
              <CardDescription>
                {copy.setup.detailsBody}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="app-name">{copy.setup.appName}</Label>
                  <Input id="app-name" value={appName} onChange={(event) => setAppName(event.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="household-name">{copy.setup.householdName}</Label>
                  <Input
                    id="household-name"
                    value={householdName}
                    onChange={(event) => setHouseholdName(event.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{copy.setup.locale}</Label>
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
                    <Label>{copy.setup.currency}</Label>
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
                    <Label htmlFor="timezone">{copy.setup.timezone}</Label>
                    <Input
                      id="timezone"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      placeholder="Europe/Madrid"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="household-size">{copy.setup.householdSize}</Label>
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
                    {copy.setup.starterBudget}
                  </span>
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? copy.setup.saving : copy.setup.finish}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
