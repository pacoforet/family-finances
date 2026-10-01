'use client'

import { useState, useEffect, useMemo } from 'react'
import { Copy, Save, CalendarRange, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatMonthYear } from '@/lib/format'
import type { Category } from '@/db/schema'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { useUiCopy } from '@/lib/ui-copy'
import { fetchJson } from '@/lib/fetch-json'
import { MonthSwitcher, PageHeader } from '@/components/kit'

interface BudgetLineRow {
  id: string
  categoryId: string
  year: number
  month: number
  amount: number
  notes: string | null
}

export default function PresupuestoPage() {
  const settings = useAppSettings()
  const copy = useUiCopy()
  const now = new Date()
  const [year, setYear]     = useState(now.getFullYear())
  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [categories, setCategories] = useState<Category[]>([])
  const [edits, setEdits]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [cloning, setCloning] = useState(false)

  const applyTargets = useMemo<Array<{ year: number; month: number; label: string }>>(() => {
    const targets: Array<{ year: number; month: number; label: string }> = []
    const start = new Date(year, month - 1, 1)
    for (let i = 0; i < 13; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      targets.push({ year: y, month: m, label: formatMonthYear(y, m) })
    }
    return targets
  }, [year, month])

  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set())
  const [applying, setApplying]     = useState(false)
  const [applyProgress, setApplyProgress] = useState(0)
  const [applyResult, setApplyResult] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    setSelectedTargets(new Set(applyTargets.map(t => `${t.year}-${t.month}`)))
  }, [applyTargets])

  useEffect(() => {
    fetchJson('/api/categories')
      .then(d => setCategories(d.categories))
      .catch(() => alert(copy.common.loadFailed))
  }, [copy])

  useEffect(() => {
    setLoading(true)
    fetchJson(`/api/budget?year=${year}`)
      .then(d => {
        const monthLines = d.budgetLines.filter(
          (l: BudgetLineRow) => l.year === year && l.month === month
        )
        const initial: Record<string, string> = {}
        for (const l of monthLines) initial[l.categoryId] = String(l.amount)
        for (const cat of d.categories ?? []) {
          if (!initial[cat.id]) initial[cat.id] = '0'
        }
        setEdits(initial)
      })
      .catch(() => alert(copy.common.loadFailed))
      .finally(() => setLoading(false))
  }, [year, month, copy])

  useEffect(() => {
    if (categories.length === 0) return
    setEdits(prev => {
      const next = { ...prev }
      for (const cat of categories) {
        if (!next[cat.id]) next[cat.id] = '0'
      }
      return next
    })
  }, [categories])

  const shiftMonth = (delta: number) => {
    const index = year * 12 + (month - 1) + delta
    setLoading(true)
    setYear(Math.floor(index / 12))
    setMonth((index % 12) + 1)
  }

  const handleSave = async () => {
    setSaving(true)
    const linesPayload = categories
      .filter(c => !c.isIncome)
      .map(c => ({ categoryId: c.id, amount: parseFloat(edits[c.id] ?? '0') || 0 }))
    try {
      await fetchJson('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, lines: linesPayload }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert(err instanceof Error ? err.message : copy.common.requestFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleClone = async () => {
    const prevMonthVal = month === 1 ? 12 : month - 1
    const prevYearVal  = month === 1 ? year - 1 : year
    setCloning(true)
    try {
      const res = await fetch(`/api/budget?year=${prevYearVal}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const prevLines = (data.budgetLines as BudgetLineRow[]).filter(
        l => l.year === prevYearVal && l.month === prevMonthVal
      )
      if (prevLines.length === 0) {
        alert(`${copy.budget.noSavedBudget} ${prevMonthVal}/${prevYearVal}.`)
      } else {
        const next = { ...edits }
        for (const l of prevLines) next[l.categoryId] = String(l.amount)
        setEdits(next)
      }
    } catch {
      alert(copy.budget.unableCopy)
    } finally {
      setCloning(false)
    }
  }

  const handleBulkApply = async () => {
    setApplying(true)
    setApplyResult(null)
    setApplyProgress(0)
    const linesPayload = categories
      .filter(c => !c.isIncome)
      .map(c => ({ categoryId: c.id, amount: parseFloat(edits[c.id] ?? '0') || 0 }))
    if (linesPayload.length === 0) { setApplying(false); return }
    const targets = applyTargets.filter(t => selectedTargets.has(`${t.year}-${t.month}`))
    let done = 0
    for (let i = 0; i < targets.length; i++) {
      setApplyProgress(i + 1)
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: targets[i].year, month: targets[i].month, lines: linesPayload }),
      })
      if (res.ok) done++
    }
    setApplying(false)
    setApplyResult({ done, total: targets.length })
  }

  const toggleTarget = (key: string) => {
    setSelectedTargets(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  const toggleAll = () => {
    setSelectedTargets(
      selectedTargets.size === applyTargets.length
        ? new Set()
        : new Set(applyTargets.map(t => `${t.year}-${t.month}`))
    )
  }

  const expenseCats = categories.filter(c => !c.isIncome)
  const totalBudget = expenseCats.reduce((sum, c) => sum + (parseFloat(edits[c.id] ?? '0') || 0), 0)
  const sortedExpenseCats = [...expenseCats].sort(
    (a, b) => (parseFloat(edits[b.id] ?? '0') || 0) - (parseFloat(edits[a.id] ?? '0') || 0)
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7 px-4 py-8 md:px-8 md:py-10">
      <PageHeader eyebrow={settings.householdName} title={copy.budget.title} subtitle={copy.budget.subtitle} />

      {/* ── Month navigator + actions ────────────────────────────── */}
      <div className="animate-rise flex flex-wrap items-center gap-2" style={{ animationDelay: '60ms' }}>
        <MonthSwitcher year={year} month={month} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
        <Button variant="outline" size="sm" onClick={handleClone} disabled={cloning} className="ml-1">
          <Copy className="h-4 w-4 mr-1.5" />
          {cloning ? copy.budget.copying : copy.budget.copyPrevious}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowApplyDialog(true); setApplyResult(null) }}
        >
          <CalendarRange className="h-4 w-4 mr-1.5" />
          {copy.budget.applyMultiple}
        </Button>
      </div>

      {/* ── Bulk apply panel ─────────────────────────────────────── */}
      {showApplyDialog && (
        <Card className="animate-rise border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>
                {copy.budget.copyFrom}{' '}
                <span className="font-semibold capitalize">{formatMonthYear(year, month)}</span> {copy.budget.to}:
              </span>
              <button
                onClick={toggleAll}
                className="text-xs font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedTargets.size === applyTargets.length ? copy.budget.clearAll : copy.budget.selectAll}
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {applyTargets.map(t => {
                const key = `${t.year}-${t.month}`
                const isMe = t.year === year && t.month === month
                const checked = selectedTargets.has(key)
                return (
                  <button
                    key={key}
                    onClick={() => !isMe && toggleTarget(key)}
                    disabled={isMe}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left ${
                      isMe
                        ? 'opacity-35 cursor-not-allowed bg-muted'
                        : checked
                          ? 'bg-foreground/[0.05] border-foreground/20 font-medium'
                          : 'hover:bg-muted/60 border-transparent hover:border-border'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      checked && !isMe ? 'bg-foreground border-foreground' : 'border-muted-foreground/40'
                    }`}>
                      {checked && !isMe && <Check className="h-2.5 w-2.5 text-background" />}
                    </span>
                    <span className="truncate">{t.label}</span>
                  </button>
                )
              })}
            </div>

            {applyResult && (
              <div className="rounded-lg border border-positive/30 bg-positive/10 px-3 py-2.5 text-sm text-positive" role="status">
                ✓ {copy.budget.applied} {applyResult.done} {applyResult.done === 1 ? copy.budget.month : copy.budget.months}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleBulkApply}
                disabled={applying || selectedTargets.size === 0}
                size="sm"
              >
                {applying
                  ? `${copy.budget.applying} ${applyProgress}/${selectedTargets.size}...`
                  : `${copy.budget.applyTo} ${selectedTargets.size} ${selectedTargets.size === 1 ? copy.budget.month : copy.budget.months}`
                }
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowApplyDialog(false); setApplyResult(null) }}>
                {copy.budget.close}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Budget lines ─────────────────────────────────────────── */}
      <Card className="animate-rise" style={{ animationDelay: '120ms' }}>
        <CardHeader className="pb-3">
          <CardTitle>{copy.budget.categories}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <>
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-6 py-3 ${i < 7 ? 'border-b' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-2.5 h-2.5 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
              ))}
              <div className="px-6 py-4 border-t bg-muted/20 rounded-b-xl">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            </>
          ) : (
          <>
            {sortedExpenseCats.map((cat, idx) => {
              const amount = parseFloat(edits[cat.id] ?? '0') || 0
              const pct = totalBudget > 0 ? (amount / totalBudget) * 100 : 0
              return (
                <div
                  key={cat.id}
                  className={`relative flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/30 ${
                    idx < sortedExpenseCats.length - 1 ? 'border-b' : ''
                  }`}
                >
                  {/* Share of the total, drawn as a hairline along the row's base */}
                  {pct > 0 && (
                    <div
                      className="pointer-events-none absolute bottom-0 left-0 h-[2px] opacity-60"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  )}
                  <div className="flex items-center gap-3 min-w-0 z-10">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium text-sm">{cat.name}</span>
                    {pct > 0 && (
                      <span className="figures text-[11px] text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 z-10">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={edits[cat.id] ?? '0'}
                      onChange={e => setEdits(prev => ({ ...prev, [cat.id]: e.target.value }))}
                      className="figures h-9 w-32 text-right text-[14px]"
                    />
                    <span className="w-8 text-[12px] text-muted-foreground">{settings.defaultCurrency}</span>
                  </div>
                </div>
              )
            })}

          </>
          )}
        </CardContent>
      </Card>

      {/* ── Sticky total + save ──────────────────────────────────── */}
      <div className="surface sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-6">
        <div>
          <p className="eyebrow">{copy.budget.monthlyTotal}</p>
          <p className="font-display figures text-[26px] leading-tight">{formatCurrency(totalBudget)}</p>
          <p className="figures text-[12px] text-muted-foreground">
            {copy.budget.perPerson} · {formatCurrency(totalBudget / Math.max(settings.householdSize, 1))}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className={saved ? 'bg-positive hover:bg-positive' : ''}
        >
          {saved
            ? <><Check className="size-4" />{copy.budget.saved}</>
            : <><Save className="size-4" />{saving ? copy.budget.saving : copy.budget.saveBudget}</>
          }
        </Button>
      </div>
    </div>
  )
}
