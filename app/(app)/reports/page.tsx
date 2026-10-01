'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryLine, Money, MonthSwitcher, PageHeader, fill } from '@/components/kit'
import { formatCurrency, monthLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { MonthSummary } from '@/lib/budget-calculator'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { useUiCopy } from '@/lib/ui-copy'
import { fetchJson } from '@/lib/fetch-json'
import { useInitialMonth, type InitialMonth } from '@/components/kit/use-initial-month'

type YearRow = { month: string; monthNumber: number; spent: number; budgeted: number }

function TooltipShell({ children }: { children: React.ReactNode }) {
  return <div className="min-w-36 rounded-xl border bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-lg">{children}</div>
}

function PieTooltip({ active, payload, total }: {
  active?: boolean
  payload?: { name: string; value: number; payload: { color: string } }[]
  total: number
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TooltipShell>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: d.payload.color }} />
        <span className="font-medium">{d.name}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="figures text-xs text-muted-foreground">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
        <Money amount={d.value} className="font-semibold" />
      </div>
    </TooltipShell>
  )
}

function BarTooltip({ active, payload, label, labels }: {
  active?: boolean
  payload?: { payload: YearRow }[]
  label?: string
  labels: { spent: string; budget: string }
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <TooltipShell>
      <p className="mb-1.5 font-medium capitalize">{label}</p>
      <div className="flex justify-between gap-4 text-xs">
        <span className="text-muted-foreground">{labels.spent}</span>
        <Money amount={row.spent} className="font-semibold" />
      </div>
      <div className="flex justify-between gap-4 text-xs">
        <span className="text-muted-foreground">{labels.budget}</span>
        <Money amount={row.budgeted} />
      </div>
    </TooltipShell>
  )
}

export default function InformesPage() {
  const initial = useInitialMonth(null)
  if (!initial) return <div className="p-8 text-sm text-muted-foreground">…</div>
  return <Reports initial={initial} />
}

function Reports({ initial }: { initial: InitialMonth }) {
  const settings = useAppSettings()
  const copy = useUiCopy()
  const t = copy.reports
  const now = new Date()
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly')
  const [summary, setSummary] = useState<MonthSummary | null>(null)
  const [yearData, setYearData] = useState<YearRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (view !== 'monthly') return
    fetchJson(`/api/budget/${year}/${month}`)
      .then(d => setSummary(d.summary))
      .catch(() => { setSummary(null); alert(copy.common.loadFailed) })
      .finally(() => setLoading(false))
  }, [year, month, view, copy])

  useEffect(() => {
    if (view !== 'yearly') return
    fetchJson<{ months: Array<{ month: number; budgeted: number; actual: number }> }>(`/api/reports/year?year=${year}`)
      .then(({ months }) => setYearData(months.map(m => ({
        month: monthLabel(year, m.month),
        monthNumber: m.month,
        spent: m.actual,
        budgeted: m.budgeted,
      }))))
      .catch(() => alert(copy.common.loadFailed))
      .finally(() => setLoading(false))
  }, [year, view, copy])

  const shiftMonth = (delta: number) => {
    const index = year * 12 + (month - 1) + delta
    setLoading(true)
    setYear(Math.floor(index / 12))
    setMonth((index % 12) + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const pieData = summary?.lines
    .filter(l => l.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .map(l => ({ name: l.categoryName, value: l.actual, color: l.color })) ?? []
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)
  const sortedLines = summary?.lines
    .filter(l => l.budgeted > 0 || l.actual > 0)
    .sort((a, b) => b.actual - a.actual) ?? []

  // Months still to come only carry annual expenses spread forward: leave them
  // out of the totals and the average.
  const elapsed = yearData.filter(d =>
    year < now.getFullYear() || (year === now.getFullYear() && d.monthNumber <= now.getMonth() + 1))
  const monthsWithData = elapsed.filter(d => d.spent > 0)
  const yearTotal = elapsed.reduce((s, d) => s + d.spent, 0)
  // The month in progress would drag the average down: average closed months
  const closed = monthsWithData.filter(d => !(year === now.getFullYear() && d.monthNumber === now.getMonth() + 1))
  const avgBase = closed.length > 0 ? closed : monthsWithData
  const yearAvg = avgBase.length > 0 ? avgBase.reduce((sum, d) => sum + d.spent, 0) / avgBase.length : 0
  const monthsOver = monthsWithData.filter(d => d.budgeted > 0 && d.spent > d.budgeted).length
  const statusLabels = { ok: t.onTrack, warning: t.watch, over: t.over }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 py-8 md:px-8 md:py-10">
      <PageHeader
        eyebrow={settings.householdName}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <div role="tablist" className="inline-flex rounded-full border bg-card p-1">
            {(['monthly', 'yearly'] as const).map(v => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => { if (view !== v) { setLoading(true); setView(v) } }}
                className={cn(
                  'rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors',
                  view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'monthly' ? t.monthly : t.yearly}
              </button>
            ))}
          </div>
        }
      />

      <div className="animate-rise" style={{ animationDelay: '60ms' }}>
        {view === 'monthly' ? (
          <MonthSwitcher year={year} month={month} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} canGoNext={!isCurrentMonth} />
        ) : (
          <div className="surface inline-flex items-center gap-1 rounded-full p-1">
            <button type="button" aria-label="Año anterior" onClick={() => { setLoading(true); setYear(y => y - 1) }}
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-display figures min-w-20 text-center text-[17px]">{year}</span>
            <button type="button" aria-label="Año siguiente" disabled={year >= now.getFullYear()}
              onClick={() => { setLoading(true); setYear(y => y + 1) }}
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30">
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="surface space-y-2 p-5"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-28" /></div>)}
          <div className="surface h-72 md:col-span-4" />
        </div>
      ) : view === 'monthly' ? (
        !summary || summary.lines.length === 0 ? (
          <Card><CardContent className="py-14 text-center text-muted-foreground">{t.noData}</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Kpi delay={100} label={t.spent} value={<Money amount={summary.totals.actual} />}
                hint={`${summary.totals.pct}% ${t.of} ${t.budget.toLowerCase()}`} />
              <Kpi delay={140} label={t.budget} value={<Money amount={summary.totals.budgeted} />} hint={t.plannedTotal} />
              <Kpi delay={180}
                label={summary.totals.variance >= 0 ? t.remaining : t.over}
                value={<Money amount={summary.totals.variance} tone signed className={summary.totals.variance < 0 ? 'text-negative' : undefined} />}
                hint={summary.totals.variance >= 0 ? t.underBudget : t.overBudget} />
              <Kpi delay={220} label={t.perPerson} value={<Money amount={summary.perPerson.actual} />}
                hint={`${t.of} ${formatCurrency(summary.perPerson.budgeted)}`} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Card className="animate-rise lg:col-span-3" style={{ animationDelay: '260ms' }}>
                <CardHeader className="pb-1"><CardTitle>{t.byCategory}</CardTitle></CardHeader>
                <CardContent className="divide-y divide-border/70">
                  {sortedLines.map(l => <CategoryLine key={l.categoryId} line={l} labels={{ ...statusLabels, of: t.of }} />)}
                </CardContent>
              </Card>

              <Card className="animate-rise lg:col-span-2" style={{ animationDelay: '320ms' }}>
                <CardHeader className="pb-1"><CardTitle>{t.distribution}</CardTitle></CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{t.noSpending}</div>
                  ) : (
                    <>
                      <div className="relative">
                        <ResponsiveContainer width="100%" height={210}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={1.5}
                              dataKey="value" stroke="var(--card)" strokeWidth={2}>
                              {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                            </Pie>
                            <Tooltip content={<PieTooltip total={pieTotal} />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="font-display figures text-[20px] leading-none">{formatCurrency(pieTotal)}</div>
                            <div className="eyebrow mt-1 text-[9.5px]">{t.totalSpent}</div>
                          </div>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-2 border-t pt-4">
                        {pieData.slice(0, 7).map(d => (
                          <li key={d.name} className="flex items-center justify-between gap-2 text-[12.5px]">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="truncate text-muted-foreground">{d.name}</span>
                            </span>
                            <span className="figures shrink-0 font-medium">{pieTotal > 0 ? ((d.value / pieTotal) * 100).toFixed(0) : 0}%</span>
                          </li>
                        ))}
                        {pieData.length > 7 && (
                          <li className="pt-0.5 text-center text-[11px] text-muted-foreground">+{pieData.length - 7} {t.moreCategories}</li>
                        )}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi delay={100} label={t.totalSpent} value={<Money amount={yearTotal} />}
              hint={fill(t.monthsOver, { count: monthsOver, total: monthsWithData.length })} />
            <Kpi delay={140} label={t.monthlyAverage} value={<Money amount={yearAvg} />}
              hint={`${avgBase.length} ${t.monthsWithData}`} />
            <Kpi delay={180} label={t.perPersonYear} value={<Money amount={yearTotal / Math.max(settings.householdSize, 1)} />} hint={String(year)} />
          </div>

          <Card className="animate-rise" style={{ animationDelay: '220ms' }}>
            <CardHeader>
              <CardTitle>{t.totalSpendingByMonth} · {year}</CardTitle>
              <div className="flex items-center gap-4 pt-1 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />{t.spent}</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-terracotta" />{t.overBudget}</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-foreground/50" />{t.budget}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${Math.round(v / 100) / 10}k`} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false} tickLine={false} width={40}
                    domain={[0, Math.ceil(Math.max(1, ...yearData.map(d => Math.max(d.spent, d.budgeted))) * 1.05)]} />
                  <Tooltip content={<BarTooltip labels={{ spent: t.spent, budget: t.budget }} />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
                  <Bar dataKey="spent" name={t.spent} radius={[4, 4, 0, 0]}
                    shape={(props: unknown) => <BudgetBar {...(props as BudgetBarProps)} />}>
                    {yearData.map((d, i) => (
                      <Cell key={i} fill={d.budgeted > 0 && d.spent > d.budgeted ? 'var(--terracotta)' : 'var(--primary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

interface BudgetBarProps {
  x: number
  y: number
  width: number
  height: number
  fill: string
  background?: { y: number; height: number }
  payload: YearRow
  value: number
}

/** Spending bar with the month's budget drawn as a tick across it. */
function BudgetBar({ x, y, width, height, fill: color, payload, value }: BudgetBarProps) {
  const r = Math.min(4, width / 2, Math.max(height, 0))
  const scale = value > 0 ? height / value : 0
  const bottom = y + height
  const budgetY = scale > 0 ? bottom - payload.budgeted * scale : null
  return (
    <g>
      {height > 0 && (
        <path d={`M${x},${bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${bottom} Z`} fill={color} />
      )}
      {budgetY !== null && payload.budgeted > 0 && (
        <line x1={x - 3} x2={x + width + 3} y1={budgetY} y2={budgetY} stroke="var(--foreground)" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
      )}
    </g>
  )
}

function Kpi({ label, value, hint, delay }: { label: string; value: React.ReactNode; hint: string; delay: number }) {
  return (
    <div className="surface animate-rise space-y-1 p-5" style={{ animationDelay: `${delay}ms` }}>
      <p className="eyebrow">{label}</p>
      <p className="font-display text-[24px] leading-tight">{value}</p>
      <p className="text-[12px] text-muted-foreground">{hint}</p>
    </div>
  )
}
