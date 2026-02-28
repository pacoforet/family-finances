'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet, Users, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatMonthYear, monthLabel } from '@/lib/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import type { MonthSummary } from '@/lib/budget-calculator'

// ─── Custom tooltip for donut chart ─────────────────────────────────────────
function PieTooltip({ active, payload, total }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[]; total: number }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
  return (
    <div className="bg-white border shadow-lg rounded-lg px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.payload.color }} />
        <span className="font-medium">{d.name}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="text-muted-foreground text-xs">{pct}%</span>
        <span className="font-mono font-semibold">{formatCurrency(d.value)}</span>
      </div>
    </div>
  )
}

// ─── Custom tooltip for bar chart ───────────────────────────────────────────
function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border shadow-lg rounded-lg px-3 py-2.5 text-sm min-w-36">
      <p className="font-medium mb-2 capitalize">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-mono font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function InformesPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [view, setView]   = useState<'mensual' | 'anual'>('mensual')
  const [summary, setSummary] = useState<MonthSummary | null>(null)
  const [yearData, setYearData] = useState<Array<{ month: string; total: number; presupuesto: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (view !== 'mensual') return
    fetch(`/api/budget/${year}/${month}`)
      .then(r => r.json())
      .then(d => { setSummary(d.summary); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, month, view])

  useEffect(() => {
    if (view !== 'anual') return
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/budget/${year}/${i + 1}`).then(r => r.json())
      )
    ).then(results => {
      setYearData(results.map((d, i) => ({
        month: monthLabel(year, i + 1),
        total: d.summary?.totals.actual ?? 0,
        presupuesto: d.summary?.totals.budgeted ?? 0,
      })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [year, view])

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

  // ── Derived data ───────────────────────────────────────────────────────────
  const pieData = summary?.lines
    .filter(l => l.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .map(l => ({ name: l.categoryName, value: l.actual, color: l.color })) ?? []

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)

  const sortedLines = summary?.lines
    .filter(l => l.budgeted > 0 || l.actual > 0)
    .sort((a, b) => b.actual - a.actual) ?? []

  const overBudget = summary?.lines.filter(l => l.status === 'over') ?? []
  const savings = summary?.totals.variance ?? 0

  const yearMonthsWithData = yearData.filter(d => d.total > 0)
  const yearTotal   = yearData.reduce((s, d) => s + d.total, 0)
  const yearAvg     = yearMonthsWithData.length > 0 ? yearTotal / yearMonthsWithData.length : 0
  const yearPerson  = yearTotal / 2

  return (
    <div className="p-6 space-y-6 w-full">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Informes</h1>
          <p className="text-muted-foreground text-sm">Análisis de tus gastos</p>
        </div>

        {/* Segmented control */}
        <div className="flex rounded-lg border p-0.5 gap-0.5 bg-muted/40">
          {(['mensual', 'anual'] as const).map(v => (
            <button
              key={v}
              onClick={() => { if (view !== v) { setLoading(true); setView(v) } }}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all capitalize ${
                view === v
                  ? 'bg-white shadow-sm text-foreground dark:bg-gray-800'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'mensual' ? 'Mensual' : 'Anual'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Month / Year navigator ────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon"
          onClick={view === 'mensual' ? prevMonth : () => { setLoading(true); setYear(y => y - 1) }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-medium min-w-48 text-center capitalize">
          {view === 'mensual' ? formatMonthYear(year, month) : String(year)}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={view === 'mensual' ? nextMonth : () => { setLoading(true); setYear(y => y + 1) }}
          disabled={
            view === 'mensual'
              ? year === now.getFullYear() && month === now.getMonth() + 1
              : year === now.getFullYear()
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>

      ) : view === 'mensual' ? (
        /* ════════════════════════ MENSUAL ════════════════════════ */
        <>
          {(!summary || summary.lines.length === 0) ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No hay datos para este mes
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── KPI cards ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Gastado</p>
                        <p className="text-2xl font-bold mt-1 font-mono tracking-tight">{formatCurrency(summary.totals.actual)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{summary.totals.pct}% del presupuesto</p>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                        <Wallet className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Presupuesto</p>
                        <p className="text-2xl font-bold mt-1 font-mono tracking-tight">{formatCurrency(summary.totals.budgeted)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Total planificado</p>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={savings >= 0
                  ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                  : 'border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20'
                }>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                          {savings >= 0 ? 'Ahorro' : 'Exceso'}
                        </p>
                        <p className={`text-2xl font-bold mt-1 font-mono tracking-tight ${
                          savings >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'
                        }`}>
                          {savings >= 0 ? '+' : ''}{formatCurrency(savings)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {savings >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'}
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg ${
                        savings >= 0 ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-red-100 dark:bg-red-900'
                      }`}>
                        {savings >= 0
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
                        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Por persona</p>
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

              {/* ── Over-budget alert ─────────────────────────────────────── */}
              {overBudget.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-red-800 dark:text-red-300">
                    <span className="font-semibold">Presupuesto superado</span>{' '}
                    en {overBudget.map(c => c.categoryName).join(', ')}
                  </span>
                </div>
              )}

              {/* ── Category breakdown + Donut ────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Horizontal progress bars */}
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Por categoría</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sortedLines.map(l => {
                      const pct = Math.min(l.pct, 100)
                      const barColor =
                        l.status === 'over' ? '#EF4444' :
                        l.status === 'warning' ? '#F59E0B' :
                        l.color
                      return (
                        <div key={l.categoryId} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                              <span className="text-sm font-medium truncate">{l.categoryName}</span>
                              {l.status === 'over' && (
                                <span className="shrink-0 text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold">
                                  Superado
                                </span>
                              )}
                              {l.status === 'warning' && (
                                <span className="shrink-0 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                                  Atención
                                </span>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <span className={`font-mono text-xs font-semibold ${l.status === 'over' ? 'text-red-600' : ''}`}>
                                {formatCurrency(l.actual)}
                              </span>
                              <span className="text-[11px] text-muted-foreground ml-1">
                                / {formatCurrency(l.budgeted)}
                              </span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${pct}%`, backgroundColor: barColor }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {/* Donut chart */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Distribución</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pieData.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                        Sin gastos este mes
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <ResponsiveContainer width="100%" height={190}>
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={52}
                                outerRadius={82}
                                dataKey="value"
                                stroke="white"
                                strokeWidth={2}
                              >
                                {pieData.map((entry, idx) => (
                                  <Cell key={idx} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip content={<PieTooltip total={pieTotal} />} />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Centered total */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                              <div className="text-base font-bold font-mono leading-none">{formatCurrency(pieTotal)}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">total</div>
                            </div>
                          </div>
                        </div>

                        {/* Compact legend */}
                        <div className="mt-1 space-y-1.5 border-t pt-3">
                          {pieData.slice(0, 7).map(d => (
                            <div key={d.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                <span className="text-xs text-muted-foreground truncate">{d.name}</span>
                              </div>
                              <span className="text-xs font-mono font-medium shrink-0 ml-2">
                                {pieTotal > 0 ? ((d.value / pieTotal) * 100).toFixed(0) : 0}%
                              </span>
                            </div>
                          ))}
                          {pieData.length > 7 && (
                            <p className="text-[11px] text-muted-foreground text-center pt-0.5">
                              +{pieData.length - 7} categorías más
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>

      ) : (
        /* ════════════════════════ ANUAL ════════════════════════ */
        <>
          {/* ── Annual bar chart ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gasto total por mes — {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}€`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="presupuesto" name="Presupuesto" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="Gastado" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Annual KPIs ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total gastado', value: formatCurrency(yearTotal) },
              { label: 'Media mensual', value: formatCurrency(yearAvg), note: `${yearMonthsWithData.length} meses con datos` },
              { label: 'Por persona / año', value: formatCurrency(yearPerson) },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-2xl font-bold font-mono tracking-tight">{item.value}</p>
                  {item.note && <p className="text-xs text-muted-foreground mt-1">{item.note}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
