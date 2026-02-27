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

export default function DashboardPage() {
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
  const overBudget = summary?.lines.filter(l => l.status === 'over') ?? []

  const recentTx = summary
    ? [...summary.lines.flatMap(l => l.transactions), ...summary.uncategorized]
        .sort((a, b) => (b.fechaInicio ?? '').localeCompare(a.fechaInicio ?? ''))
        .slice(0, 8)
    : []

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Panel de gastos</h1>
          <p className="text-sm text-muted-foreground">Comparativa presupuesto vs gastos reales</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Añadir gasto
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
      </div>

      {/* ── Loading ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>

      ) : !summary || summary.lines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
            <p className="text-muted-foreground text-sm">No hay presupuesto configurado para este mes.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/presupuesto">Configurar presupuesto</Link>
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
                <span className="font-semibold">Presupuesto superado</span>{' '}en{' '}
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
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Gastado</p>
                    <p className="text-2xl font-bold mt-1 font-mono tracking-tight">{formatCurrency(summary.totals.actual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{summary.totals.pct}% del presupuesto</p>
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
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Presupuesto</p>
                    <p className="text-2xl font-bold mt-1 font-mono tracking-tight">{formatCurrency(summary.totals.budgeted)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total mensual</p>
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
                      {summary.totals.variance >= 0 ? 'Ahorro' : 'Exceso'}
                    </p>
                    <p className={`text-2xl font-bold mt-1 font-mono tracking-tight ${
                      summary.totals.variance >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600'
                    }`}>
                      {summary.totals.variance >= 0 ? '+' : ''}{formatCurrency(summary.totals.variance)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.totals.variance >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'}
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
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Por persona</p>
                    <p className="text-2xl font-bold mt-1 font-mono tracking-tight">{formatCurrency(summary.perPerson.actual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">de {formatCurrency(summary.perPerson.budgeted)}</p>
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
                <CardTitle className="text-base">Por categoría</CardTitle>
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
                              Superado
                            </span>
                          )}
                          {line.status === 'warning' && (
                            <span className="shrink-0 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                              Atención
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
                        {summary.uncategorized.length} transacción{summary.uncategorized.length !== 1 ? 'es' : ''} sin categorizar
                      </span>
                    </div>
                    <Link
                      href={`/transacciones?month=${toMonthKey(year, month)}&uncategorized=true`}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      Categorizar <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent transactions — 2 cols */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Últimas transacciones</CardTitle>
                  <Link
                    href={`/transacciones?month=${toMonthKey(year, month)}`}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    Ver todas <ArrowRight className="h-3 w-3" />
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
        }}
      />
    </div>
  )
}
