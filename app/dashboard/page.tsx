'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, Plus, TrendingDown, TrendingUp, Users, Wallet, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate, formatMonthYear, toMonthKey } from '@/lib/format'
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog'
import Link from 'next/link'
import type { MonthSummary } from '@/lib/budget-calculator'
import type { Category } from '@/db/schema'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'

export default function DashboardPage() {
  const settings = useAppSettings()
  const now = new Date()
  const [year, setYear]       = useState(now.getFullYear())
  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<MonthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories))
  }, [])

  useEffect(() => {
    fetch(`/api/budget/${year}/${month}`)
      .then(r => r.json())
      .then(d => { setSummary(d.summary); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, month])

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
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const goToCurrentMonth = () => {
    if (isCurrentMonth) return
    setLoading(true)
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
  }
  const overBudget = summary?.lines.filter(l => l.status === 'over') ?? []

  const recentTx = summary
    ? [...summary.lines.flatMap(l => l.transactions), ...summary.uncategorized]
        .sort((a, b) => (b.fechaInicio ?? '').localeCompare(a.fechaInicio ?? ''))
        .slice(0, 8)
    : []

  return (
    <div className="p-6 space-y-6 w-full">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Budget versus actual spending for {settings.householdName}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add expense
        </Button>
      </div>

      {/* ── Month navigator ──────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-medium min-w-48 text-center capitalize">
          {formatMonthYear(year, month)}
        </span>
        <Button variant="outline" size="icon" onClick={nextMonth} disabled={isCurrentMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToCurrentMonth} disabled={isCurrentMonth}>
          Current month
        </Button>
      </div>

      {/* ── Loading ──────────────────────────────────────────────── */}
      {loading ? (
        <>
          {/* KPI cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-7 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Category + transactions skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="space-y-5">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-2 h-2 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="w-2 h-2 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-3.5 w-14" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>

      ) : !summary || summary.lines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
            <p className="text-muted-foreground text-sm">No budget has been configured for this month yet.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/presupuesto">Set up budget</Link>
            </Button>
          </CardContent>
        </Card>

      ) : (
        <>
          {/* ── Over-budget alert ──────────────────────────────────── */}
          {overBudget.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-red-800 dark:text-red-300">
                <span className="font-semibold">Over budget</span>{' '}in{' '}
                {overBudget.map(l => l.categoryName).join(', ')}
              </span>
            </div>
          )}

          {/* ── KPI cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Spent</p>
                    <p className="text-2xl font-bold mt-1 font-mono tracking-tight">{formatCurrency(summary.totals.actual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{summary.totals.pct}% of budget</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Wallet className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Budget</p>
                    <p className="text-2xl font-bold mt-1 font-mono tracking-tight">{formatCurrency(summary.totals.budgeted)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Monthly total</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={
              summary.totals.variance >= 0
                ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                : 'border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20'
            }>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {summary.totals.variance >= 0 ? 'Remaining' : 'Over'}
                    </p>
                    <p className={`text-2xl font-bold mt-1 font-mono tracking-tight ${
                      summary.totals.variance >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600'
                    }`}>
                      {summary.totals.variance >= 0 ? '+' : ''}{formatCurrency(summary.totals.variance)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.totals.variance >= 0 ? 'Under budget' : 'Over budget'}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${
                    summary.totals.variance >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-900'
                      : 'bg-red-100 dark:bg-red-900'
                  }`}>
                    {summary.totals.variance >= 0
                      ? <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      : <AlertTriangle className="h-4 w-4 text-red-600" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Per person</p>
                    <p className="text-2xl font-bold mt-1 font-mono tracking-tight">{formatCurrency(summary.perPerson.actual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">of {formatCurrency(summary.perPerson.budgeted)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950">
                    <Users className="h-4 w-4 text-violet-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Category breakdown + Recent transactions ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Progress bars — 3 cols */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">By category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary.lines.map(line => {
                  const pct = Math.min(line.pct, 100)
                  const barColor =
                    line.status === 'over'    ? '#EF4444' :
                    line.status === 'warning' ? '#F59E0B' :
                    line.color
                  return (
                    <div key={line.categoryId} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
                          <span className="text-sm font-medium truncate">{line.categoryName}</span>
                          {line.status === 'over' && (
                            <span className="shrink-0 text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold">
                              Over
                            </span>
                          )}
                          {line.status === 'warning' && (
                            <span className="shrink-0 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                              Watch
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`font-mono text-xs font-semibold ${line.status === 'over' ? 'text-red-600' : ''}`}>
                            {formatCurrency(line.actual)}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-1">
                            / {formatCurrency(line.budgeted)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  )
                })}

                {/* Uncategorized row */}
                {summary.uncategorized.length > 0 && (
                  <div className="pt-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                        {summary.uncategorized.length} uncategorized transaction{summary.uncategorized.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <Link
                      href={`/transacciones?month=${toMonthKey(year, month)}&uncategorized=true`}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      Review <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent transactions — 2 cols */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent transactions</CardTitle>
                  <Link
                    href={`/transacciones?month=${toMonthKey(year, month)}`}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {recentTx.map(tx => {
                    const catLine = summary.lines.find(l => l.categoryId === tx.categoryId)
                    return (
                      <div key={tx.id} className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: catLine?.color ?? '#9CA3AF' }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm truncate leading-snug">{tx.descripcion}</p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(tx.fechaInicio)}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-mono font-semibold ml-3 shrink-0 ${
                          tx.importe < 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {formatCurrency(tx.importe)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <AddTransactionDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        categories={categories}
        onSaved={() => {
          setLoading(true)
          fetch(`/api/budget/${year}/${month}`)
            .then(r => r.json())
            .then(d => { setSummary(d.summary); setLoading(false) })
            .catch(() => setLoading(false))
        }}
      />
    </div>
  )
}
