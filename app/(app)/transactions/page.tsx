'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, CalendarClock, Filter, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog'
import { EditTransactionSheet } from '@/components/transactions/EditTransactionSheet'
import { SuggestionsInbox, notifySuggestionsChanged } from '@/components/transactions/SuggestionsInbox'
import { useSuggestionCount } from '@/components/layout/nav'
import { MerchantAvatar, Money, MonthSwitcher, PageHeader, fill } from '@/components/kit'
import { formatCurrency, formatLongDay, toMonthKey } from '@/lib/format'
import { useInitialMonth, type InitialMonth } from '@/components/kit/use-initial-month'
import { cn } from '@/lib/utils'
import { useUiCopy } from '@/lib/ui-copy'
import { fetchJson } from '@/lib/fetch-json'
import type { Category } from '@/db/schema'

interface TxWithCategory {
  id: string
  fechaInicio: string
  descripcion: string
  importe: number
  state: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  categorySource: string | null
  notes: string | null
  isManual: boolean
  excludeFromBudget: boolean
  splitAnnual: boolean
  budgetDate: string | null
}

export default function TransaccionesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">…</div>}>
      <TransaccionesContent />
    </Suspense>
  )
}

function TransaccionesContent() {
  const initial = useInitialMonth(useSearchParams().get('month'))
  if (!initial) return <div className="p-8 text-sm text-muted-foreground">…</div>
  return <TransactionsView initialMonth={initial} />
}

function TransactionsView({ initialMonth }: { initialMonth: InitialMonth }) {
  const copy = useUiCopy()
  const now = new Date()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'list' | 'review'>(searchParams.get('review') ? 'review' : 'list')
  const [year, setYear] = useState(initialMonth.year)
  const [month, setMonth] = useState(initialMonth.month)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [uncategorized, setUncategorized] = useState(searchParams.get('uncategorized') === 'true')
  const [allMonths, setAllMonths] = useState(false)
  const [transactions, setTransactions] = useState<TxWithCategory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedTx, setSelectedTx] = useState<TxWithCategory | null>(null)
  const pendingSuggestions = useSuggestionCount()

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const shiftMonth = (delta: number) => {
    const index = year * 12 + (month - 1) + delta
    setLoading(true); setPage(1); setAllMonths(false)
    setYear(Math.floor(index / 12))
    setMonth((index % 12) + 1)
  }
  const resetPaging = () => { setLoading(true); setPage(1) }

  useEffect(() => {
    fetchJson('/api/categories')
      .then(d => setCategories(d.categories))
      .catch(() => alert(copy.common.loadFailed))
  }, [copy])

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (!allMonths) params.set('month', toMonthKey(year, month))
    if (catFilter !== 'all') params.set('categoryId', catFilter)
    if (search) params.set('search', search)
    if (uncategorized) params.set('uncategorized', 'true')

    try {
      const data = await fetchJson(`/api/transactions?${params}`)
      setTransactions(data.transactions)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      alert(copy.common.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [year, month, page, catFilter, search, uncategorized, allMonths, copy])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  const updateCategory = async (txId: string, categoryId: string | null) => {
    try {
      await fetchJson(`/api/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      })
      notifySuggestionsChanged()
    } catch {
      alert(copy.common.requestFailed)
    }
    loadTransactions()
  }

  const totalExpenses = transactions.filter(t => t.importe < 0).reduce((s, t) => s + Math.abs(t.importe), 0)

  // Group the page by calendar day, newest first (the API already sorts by date)
  const days = useMemo(() => {
    const groups: Array<{ day: string; items: TxWithCategory[]; net: number }> = []
    for (const tx of transactions) {
      const day = String(tx.fechaInicio).slice(0, 10)
      const last = groups[groups.length - 1]
      if (last?.day === day) { last.items.push(tx); last.net += tx.importe }
      else groups.push({ day, items: [tx], net: tx.importe })
    }
    return groups
  }, [transactions])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 py-8 md:px-8 md:py-10">
      <PageHeader
        eyebrow={tab === 'list' && !loading ? fill(copy.transactions.count, { count: total }) : undefined}
        title={copy.transactions.title}
        subtitle={tab === 'list' ? `${formatCurrency(totalExpenses)} ${copy.transactions.inExpenses}` : undefined}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="size-4" />
            {copy.transactions.addManual}
          </Button>
        }
      />

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div role="tablist" className="animate-rise inline-flex rounded-full border bg-card p-1" style={{ animationDelay: '60ms' }}>
        {([
          ['list', copy.suggestions.tabList, null],
          ['review', copy.suggestions.tabReview, pendingSuggestions],
        ] as const).map(([key, label, badge]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {badge ? (
              <span className={cn(
                'figures rounded-full px-1.5 text-[10.5px] font-semibold',
                tab === key ? 'bg-primary-foreground/20' : 'bg-brass/20 text-foreground',
              )}>{badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'review' ? (
        <SuggestionsInbox categories={categories} onChanged={loadTransactions} />
      ) : (
        <>
          {/* ── Filters ──────────────────────────────────────────────── */}
          <div className="animate-rise flex flex-wrap items-center gap-2.5" style={{ animationDelay: '100ms' }}>
            <div className={cn('transition-opacity', allMonths && 'opacity-50')}>
              <MonthSwitcher
                year={year}
                month={month}
                onPrev={() => shiftMonth(-1)}
                onNext={() => shiftMonth(1)}
                canGoNext={!isCurrentMonth}
              />
            </div>
            <Button
              variant={allMonths ? 'default' : 'outline'}
              size="sm"
              onClick={() => { resetPaging(); setAllMonths(!allMonths) }}
            >
              {copy.transactions.all}
            </Button>

            <Select value={catFilter} onValueChange={value => { resetPaging(); setCatFilter(value) }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={copy.transactions.allCategories} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.transactions.allCategories}</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={copy.transactions.searchMerchant}
                value={search}
                onChange={e => { resetPaging(); setSearch(e.target.value) }}
                className="pl-9"
              />
            </div>

            <Button
              variant={uncategorized ? 'default' : 'outline'}
              size="sm"
              onClick={() => { resetPaging(); setUncategorized(!uncategorized) }}
            >
              <Filter className="size-4" />
              {copy.transactions.noCategory}
            </Button>
          </div>

          {/* ── Day-grouped ledger ───────────────────────────────────── */}
          <div className="surface animate-rise overflow-hidden" style={{ animationDelay: '140ms' }}>
            {loading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{copy.transactions.loading}</p>
            ) : days.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{copy.transactions.noMatches}</p>
            ) : (
              days.map(group => (
                <section key={group.day}>
                  <header className="flex items-baseline justify-between border-b bg-paper-deep/70 px-5 py-2 md:px-6">
                    <h3 className="text-[12.5px] font-semibold text-foreground/80 first-letter:uppercase">{formatLongDay(group.day)}</h3>
                    <Money amount={group.net} signed className="text-[12px] text-muted-foreground" />
                  </header>
                  <ul className="divide-y divide-border/60">
                    {group.items.map(tx => (
                      <TxRow
                        key={tx.id}
                        tx={tx}
                        categories={categories}
                        onOpen={() => setSelectedTx(tx)}
                        onCategory={categoryId => updateCategory(tx.id, categoryId)}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="figures text-muted-foreground">
                {copy.transactions.page} {page} {copy.transactions.of} {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setLoading(true); setPage(p => p - 1) }} disabled={page === 1}>
                  {copy.transactions.previous}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setLoading(true); setPage(p => p + 1) }} disabled={page === totalPages}>
                  {copy.transactions.next}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AddTransactionDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        categories={categories}
        onSaved={() => loadTransactions()}
      />

      {selectedTx && (
        <EditTransactionSheet
          transaction={selectedTx}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onSaved={() => {
            setSelectedTx(null)
            notifySuggestionsChanged()
            loadTransactions()
          }}
        />
      )}
    </div>
  )
}

function TxRow({ tx, categories, onOpen, onCategory }: {
  tx: TxWithCategory
  categories: Category[]
  onOpen: () => void
  onCategory: (categoryId: string | null) => void
}) {
  const copy = useUiCopy()
  const auto = tx.categorySource === 'auto_rule' || tx.categorySource === 'learned'
  return (
    <li
      className={cn(
        'group flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50 md:px-6',
        tx.excludeFromBudget && 'opacity-60',
      )}
      onClick={onOpen}
    >
      <MerchantAvatar name={tx.descripcion} color={tx.categoryColor} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{tx.descripcion}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          {/* Inline category picker; clicks on it must not open the edit sheet */}
          <span onClick={e => e.stopPropagation()}>
            <Select value={tx.categoryId ?? 'none'} onValueChange={v => onCategory(v === 'none' ? null : v)}>
              <SelectTrigger
                size="sm"
                className="h-6 gap-1.5 rounded-full border-0 bg-transparent px-2 text-[12px] shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted data-[size=sm]:h-6 -ml-2"
              >
                <SelectValue>
                  {tx.categoryId ? (
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tx.categoryColor ?? 'var(--muted-foreground)' }} />
                      {tx.categoryName}
                    </span>
                  ) : tx.excludeFromBudget ? (
                    <span>{copy.transactions.noCategory}</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-warning">
                      <span aria-hidden className="text-[8px]">▲</span>
                      {copy.transactions.noCategory}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{copy.transactions.noCategory}</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
          {auto && (
            <span title={copy.suggestions.autoBadgeTitle} className="rounded-full border px-1.5 text-[10px] font-semibold uppercase tracking-wide">
              {copy.suggestions.autoBadge}
            </span>
          )}
          {tx.excludeFromBudget && <span className="italic">{copy.editTx.excludeBudget}</span>}
          {tx.isManual && <span>{copy.transactions.addManual}</span>}
          {tx.splitAnnual && (
            <span title={copy.transactions.splitAnnualTitle} className="flex items-center">
              <CalendarClock className="size-3.5" />
            </span>
          )}
          {tx.budgetDate && (
            <span title={`${copy.editTx.trackedIn} ${tx.budgetDate.slice(0, 7)}`} className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {tx.budgetDate.slice(0, 7)}
            </span>
          )}
          {tx.notes && <span className="hidden max-w-xs truncate md:inline">· {tx.notes}</span>}
        </div>
      </div>
      <Money amount={tx.importe} tone signed className="text-[14px] font-semibold" />
    </li>
  )
}
