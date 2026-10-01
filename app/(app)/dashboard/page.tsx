'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog'
import { useSuggestionCount } from '@/components/layout/nav'
import {
  MerchantAvatar, Meter, Money, MonthSwitcher, PageHeader, PaceChart, StatusPill, fill, monthTitle,
} from '@/components/kit'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { formatCurrency, formatDayMonth, fromMonthKey, toMonthKey } from '@/lib/format'
import { useUiCopy } from '@/lib/ui-copy'
import { fetchJson } from '@/lib/fetch-json'
import type { MonthSummary } from '@/lib/budget-calculator'
import type { Category } from '@/db/schema'

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  )
}

function Dashboard() {
  const settings = useAppSettings()
  const copy = useUiCopy()
  const now = new Date()
  const monthParam = useSearchParams().get('month')
  const initial = monthParam ? fromMonthKey(monthParam) : { year: now.getFullYear(), month: now.getMonth() + 1 }
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [summary, setSummary] = useState<MonthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const pendingSuggestions = useSuggestionCount()

  useEffect(() => {
    fetchJson('/api/categories')
      .then(d => setCategories(d.categories))
      .catch(() => alert(copy.common.loadFailed))
  }, [copy])

  const loadSummary = useCallback(() => {
    setLoading(true)
    return fetchJson(`/api/budget/${year}/${month}`)
      .then(d => setSummary(d.summary))
      .catch(() => { setSummary(null); alert(copy.common.loadFailed) })
      .finally(() => setLoading(false))
  }, [year, month, copy])

  useEffect(() => { loadSummary() }, [loadSummary])

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const shiftMonth = (delta: number) => {
    const index = year * 12 + (month - 1) + delta
    setYear(Math.floor(index / 12))
    setMonth((index % 12) + 1)
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pace = isCurrentMonth ? now.getDate() / daysInMonth : undefined

  const income = useMemo(
    () => (summary?.income ?? []).reduce((sum, t) => sum + t.importe, 0),
    [summary],
  )
  const colorById = useMemo(
    () => new Map((summary?.lines ?? []).map(l => [l.categoryId, l.color])),
    [summary],
  )
  const recentTx = summary
    ? [...summary.lines.flatMap(l => l.transactions), ...summary.uncategorized, ...summary.income]
        .sort((a, b) => String(b.fechaInicio ?? '').localeCompare(String(a.fechaInicio ?? '')))
        .slice(0, 8)
    : []

  const statusLabels = { ok: copy.dashboard.onTrack, warning: copy.dashboard.watch, over: copy.dashboard.over }
  const totals = summary?.totals
  const over = totals ? totals.variance < 0 : false

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-10">
      <PageHeader
        eyebrow={settings.householdName}
        title={copy.dashboard.title}
        actions={
          <>
            <MonthSwitcher
              year={year}
              month={month}
              onPrev={() => shiftMonth(-1)}
              onNext={() => shiftMonth(1)}
              onToday={isCurrentMonth ? undefined : () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
              todayLabel={copy.dashboard.currentMonth}
            />
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="size-4" />
              {copy.dashboard.addExpense}
            </Button>
          </>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : !summary || !totals || summary.lines.length === 0 ? (
        <Card className="animate-rise">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="font-display text-xl">{monthTitle(year, month)}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{copy.dashboard.noBudget}</p>
            <Button asChild variant="outline">
              <Link href="/budget">{copy.dashboard.setupBudget}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Hero: spending against the budget ─────────────────────── */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="surface animate-rise relative flex flex-col overflow-hidden p-6 md:p-8 lg:col-span-2" style={{ animationDelay: '60ms' }}>
              <p className="eyebrow">{copy.dashboard.spentIn} {monthTitle(year, month).toLowerCase()}</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display figures text-[44px] leading-none md:text-[60px]">
                  {formatCurrency(totals.actual)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {fill(copy.dashboard.ofBudgeted, { amount: formatCurrency(totals.budgeted) })}
                </span>
              </div>

              <Meter value={totals.actual} max={totals.budgeted} marker={pace} className="mt-7 h-2" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className={over ? 'font-medium text-negative' : 'font-medium text-positive'}>
                  <span aria-hidden className="mr-1.5">{over ? '■' : '●'}</span>
                  {fill(over ? copy.dashboard.overBy : copy.dashboard.leftToSpend, {
                    amount: formatCurrency(Math.abs(totals.variance)),
                  })}
                </span>
                <span className="figures text-muted-foreground">
                  {totals.pct}%
                  {pace !== undefined && (
                    <> · {fill(copy.dashboard.dayOf, { day: now.getDate(), days: daysInMonth })}</>
                  )}
                </span>
              </div>

              <PaceChart
                className="mt-auto pt-8"
                cumulative={summary.cumulativeByDay}
                budget={totals.budgeted}
                upToDay={isCurrentMonth ? now.getDate() : undefined}
                labels={{ budget: copy.dashboard.budgetLine, pace: copy.dashboard.monthPace }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <Tile
                delay={120}
                label={copy.dashboard.income}
                value={<Money amount={income} />}
                hint={fill(copy.dashboard.incomeHint, { count: summary.income.length })}
              />
              <Tile
                delay={170}
                label={copy.dashboard.margin}
                value={<Money amount={income - totals.actual} tone signed />}
                hint={copy.dashboard.marginHint}
              />
              <Tile
                delay={220}
                label={copy.dashboard.perPerson}
                value={<Money amount={summary.perPerson.actual} />}
                hint={`${copy.dashboard.of} ${formatCurrency(summary.perPerson.budgeted)}`}
              />
            </div>
          </section>

          {/* ── Review callout ────────────────────────────────────────── */}
          {(pendingSuggestions > 0 || summary.uncategorized.length > 0) && (
            <Link
              href={pendingSuggestions > 0
                ? '/transactions?review=1'
                : `/transactions?month=${toMonthKey(year, month)}&uncategorized=true`}
              className="animate-rise group flex items-center gap-4 rounded-2xl border border-brass/40 bg-brass/8 px-5 py-4 transition-colors hover:bg-brass/14"
              style={{ animationDelay: '260ms' }}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brass/20 text-brass">
                <Sparkles className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">
                  {pendingSuggestions > 0
                    ? copy.dashboard.suggestionsTitle
                    : `${summary.uncategorized.length} ${summary.uncategorized.length === 1 ? copy.dashboard.uncategorizedOne : copy.dashboard.uncategorized}`}
                </span>
                {pendingSuggestions > 0 && (
                  <span className="block text-[13px] text-muted-foreground">
                    {pendingSuggestions === 1
                      ? copy.dashboard.suggestionsBodyOne
                      : fill(copy.dashboard.suggestionsBody, { count: pendingSuggestions })}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1 text-[13px] font-medium">
                {copy.dashboard.reviewSuggestions}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          )}

          {/* ── Categories + recent activity ──────────────────────────── */}
          <section className="grid gap-4 lg:grid-cols-5">
            <Card className="animate-rise lg:col-span-3" style={{ animationDelay: '300ms' }}>
              <CardHeader className="pb-1">
                <CardTitle>{copy.dashboard.byCategory}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-border/70">
                {summary.lines.map(line => (
                  <div key={line.categoryId} className="space-y-2 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: line.color }} />
                        <span className="truncate text-[14px] font-medium">{line.categoryName}</span>
                        {line.status !== 'ok' && <StatusPill status={line.status} labels={statusLabels} />}
                      </div>
                      <div className="shrink-0 text-right text-[13px]">
                        <Money amount={line.actual} className={line.status === 'over' ? 'font-semibold text-negative' : 'font-semibold'} />
                        <span className="figures text-muted-foreground"> / {formatCurrency(line.budgeted)}</span>
                      </div>
                    </div>
                    <Meter value={line.actual} max={line.budgeted} color={line.color} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="animate-rise lg:col-span-2" style={{ animationDelay: '360ms' }}>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle>{copy.dashboard.recentTransactions}</CardTitle>
                <Link
                  href={`/transactions?month=${toMonthKey(year, month)}`}
                  className="flex items-center gap-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {copy.dashboard.viewAll} <ArrowUpRight className="size-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="px-3">
                {recentTx.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">{copy.dashboard.nothingRecent}</p>
                ) : (
                  <ul>
                    {recentTx.map(tx => (
                      <li key={tx.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60">
                        <MerchantAvatar name={tx.descripcion} color={tx.categoryId ? colorById.get(tx.categoryId) : null} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] leading-snug">{tx.descripcion}</p>
                          <p className="text-[11.5px] text-muted-foreground">{formatDayMonth(String(tx.fechaInicio))}</p>
                        </div>
                        <Money amount={tx.importe} tone signed className="text-[13px] font-semibold" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      <AddTransactionDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        categories={categories}
        onSaved={() => { loadSummary() }}
      />
    </div>
  )
}

function Tile({ label, value, hint, delay }: { label: string; value: React.ReactNode; hint: string; delay: number }) {
  return (
    <div className="surface animate-rise flex flex-col justify-between gap-1 p-5" style={{ animationDelay: `${delay}ms` }}>
      <p className="eyebrow">{label}</p>
      <p className="font-display text-[26px] leading-tight">{value}</p>
      <p className="text-[12px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface space-y-5 p-8 lg:col-span-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-14 w-72" />
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="grid gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="surface space-y-2 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="surface space-y-5 p-6 lg:col-span-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
        <div className="surface space-y-4 p-6 lg:col-span-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>
    </div>
  )
}
