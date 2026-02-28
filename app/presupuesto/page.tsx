'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Copy, Save, CalendarRange, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatMonthYear } from '@/lib/format'
import type { Category } from '@/db/schema'
import { Skeleton } from '@/components/ui/skeleton'

interface BudgetLineRow {
  id: string
  categoryId: string
  year: number
  month: number
  amount: number
  notes: string | null
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function PresupuestoPage() {
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
      targets.push({ year: y, month: m, label: `${MONTH_NAMES[m - 1]} ${y}` })
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
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories))
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/budget?year=${year}`)
      .then(r => r.json())
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
      .finally(() => setLoading(false))
  }, [year, month])

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

  const prevMonth = () => {
    setLoading(true)
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    setLoading(true)
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const handleSave = async () => {
    setSaving(true)
    const linesPayload = categories
      .filter(c => c.name !== 'Sin categoría' && !c.isIncome)
      .map(c => ({ categoryId: c.id, amount: parseFloat(edits[c.id] ?? '0') || 0 }))
    await fetch('/api/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, lines: linesPayload }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
        alert(`No hay presupuesto guardado en ${prevMonthVal}/${prevYearVal}`)
      } else {
        const next = { ...edits }
        for (const l of prevLines) next[l.categoryId] = String(l.amount)
        setEdits(next)
      }
    } catch {
      alert('No se pudo copiar el mes anterior')
    } finally {
      setCloning(false)
    }
  }

  const handleBulkApply = async () => {
    setApplying(true)
    setApplyResult(null)
    setApplyProgress(0)
    const linesPayload = categories
      .filter(c => c.name !== 'Sin categoría' && !c.isIncome)
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

  const expenseCats = categories.filter(c => c.name !== 'Sin categoría' && !c.isIncome)
  const totalBudget = expenseCats.reduce((sum, c) => sum + (parseFloat(edits[c.id] ?? '0') || 0), 0)
  const sortedExpenseCats = [...expenseCats].sort(
    (a, b) => (parseFloat(edits[b.id] ?? '0') || 0) - (parseFloat(edits[a.id] ?? '0') || 0)
  )

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold">Presupuesto mensual</h1>
        <p className="text-sm text-muted-foreground">Configura cuánto planéais gastar en cada categoría</p>
      </div>

      {/* ── Month navigator + actions ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-medium min-w-48 text-center capitalize">
          {formatMonthYear(year, month)}
        </span>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleClone} disabled={cloning} className="ml-1">
          <Copy className="h-4 w-4 mr-1.5" />
          {cloning ? 'Copiando...' : 'Copiar mes anterior'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowApplyDialog(true); setApplyResult(null) }}
        >
          <CalendarRange className="h-4 w-4 mr-1.5" />
          Aplicar a varios meses
        </Button>
      </div>

      {/* ── Bulk apply panel ─────────────────────────────────────── */}
      {showApplyDialog && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>
                Copiar presupuesto de{' '}
                <span className="font-semibold capitalize">{formatMonthYear(year, month)}</span> a:
              </span>
              <button
                onClick={toggleAll}
                className="text-xs font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedTargets.size === applyTargets.length ? 'Desmarcar todo' : 'Marcar todo'}
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
              <div className="px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
                ✓ Presupuesto aplicado a {applyResult.done} {applyResult.done === 1 ? 'mes' : 'meses'}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleBulkApply}
                disabled={applying || selectedTargets.size === 0}
                size="sm"
              >
                {applying
                  ? `Aplicando ${applyProgress}/${selectedTargets.size}…`
                  : `Aplicar a ${selectedTargets.size} ${selectedTargets.size === 1 ? 'mes' : 'meses'}`
                }
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowApplyDialog(false); setApplyResult(null) }}>
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Budget lines ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Partidas presupuestarias</CardTitle>
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
                  {/* Subtle proportion bar behind the row */}
                  {pct > 0 && (
                    <div
                      className="absolute left-0 top-0 h-full opacity-[0.035] pointer-events-none rounded-none"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  )}
                  <div className="flex items-center gap-3 min-w-0 z-10">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium text-sm">{cat.name}</span>
                    {pct > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
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
                      className="w-28 text-right font-mono h-8 text-sm"
                    />
                    <span className="text-muted-foreground text-sm w-3">€</span>
                  </div>
                </div>
              )
            })}

            {/* Total footer */}
            <div className="px-6 py-4 border-t bg-muted/20 rounded-b-xl">
              <div className="flex items-center justify-between font-semibold">
                <span>Total mensual</span>
                <span className="font-mono text-lg">{formatCurrency(totalBudget)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground mt-0.5">
                <span>Por persona</span>
                <span className="font-mono">{formatCurrency(totalBudget / 2)}</span>
              </div>
            </div>
          </>
          )}
        </CardContent>
      </Card>

      {/* ── Save button ──────────────────────────────────────────── */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className={`transition-all ${saved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
      >
        {saved
          ? <><Check className="h-4 w-4 mr-1.5" />¡Guardado!</>
          : <><Save className="h-4 w-4 mr-1.5" />{saving ? 'Guardando...' : 'Guardar presupuesto'}</>
        }
      </Button>
    </div>
  )
}
