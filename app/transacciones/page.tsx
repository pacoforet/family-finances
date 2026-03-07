'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Plus, Filter, CalendarClock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, toMonthKey, fromMonthKey, formatMonthYear } from '@/lib/format'
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog'
import { EditTransactionSheet } from '@/components/transactions/EditTransactionSheet'
import type { Category } from '@/db/schema'
import { useUiCopy } from '@/lib/ui-copy'

interface TxWithCategory {
  id: string
  fechaInicio: string
  descripcion: string
  importe: number
  state: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  notes: string | null
  isManual: boolean
  excludeFromBudget: boolean
  splitAnnual: boolean
  budgetDate: string | null
}

export default function TransaccionesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <TransaccionesContent />
    </Suspense>
  )
}

function TransaccionesContent() {
  const copy = useUiCopy()
  const now = new Date()
  const searchParams = useSearchParams()
  const initialMonth = searchParams.get('month')
    ? fromMonthKey(searchParams.get('month')!)
    : { year: now.getFullYear(), month: now.getMonth() + 1 }
  const [year, setYear]               = useState(initialMonth.year)
  const [month, setMonth]             = useState(initialMonth.month)
  const [search, setSearch]           = useState('')
  const [catFilter, setCatFilter]     = useState('all')
  const [uncategorized, setUncategorized] = useState(searchParams.get('uncategorized') === 'true')
  const [allMonths, setAllMonths]         = useState(false)

  const prevMonth = () => {
    setLoading(true); setPage(1); setAllMonths(false)
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    setLoading(true); setPage(1); setAllMonths(false)
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const [transactions, setTransactions] = useState<TxWithCategory[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)
  const [loading, setLoading]         = useState(true)
  const [categories, setCategories]   = useState<Category[]>([])
  const [showAdd, setShowAdd]         = useState(false)
  const [selectedTx, setSelectedTx]  = useState<TxWithCategory | null>(null)

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories))
  }, [])

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '50',
    })
    if (!allMonths) params.set('month', toMonthKey(year, month))
    if (catFilter && catFilter !== 'all') params.set('categoryId', catFilter)
    if (search) params.set('search', search)
    if (uncategorized) params.set('uncategorized', 'true')

    try {
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      setTransactions(data.transactions)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [year, month, page, catFilter, search, uncategorized, allMonths])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const updateCategory = async (txId: string, categoryId: string | null) => {
    await fetch(`/api/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId }),
    })
    setLoading(true)
    loadTransactions()
  }

  const expenses = transactions.filter(t => t.importe < 0)
  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.importe), 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{copy.transactions.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} {copy.transactions.title.toLowerCase()} · {formatCurrency(totalExpenses)} {copy.transactions.inExpenses}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          {copy.transactions.addManual}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Month switcher */}
        <div className="flex items-center gap-1">
          <Button
            variant={allMonths ? 'default' : 'outline'}
            onClick={() => { setLoading(true); setPage(1); setAllMonths(!allMonths) }}
          >
            {copy.transactions.all}
          </Button>
          <Button variant="outline" size="icon" onClick={prevMonth} disabled={allMonths}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className={`text-sm font-medium min-w-40 text-center capitalize px-1 ${allMonths ? 'text-muted-foreground' : ''}`}>
            {formatMonthYear(year, month)}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth} disabled={allMonths || isCurrentMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={catFilter} onValueChange={(value) => {
          setLoading(true)
          setPage(1)
          setCatFilter(value)
        }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={copy.transactions.allCategories} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.transactions.allCategories}</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={copy.transactions.searchMerchant}
            value={search}
            onChange={e => {
              setLoading(true)
              setPage(1)
              setSearch(e.target.value)
            }}
            className="pl-9"
          />
        </div>

        <Button
          variant={uncategorized ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setLoading(true)
            setPage(1)
            setUncategorized(!uncategorized)
          }}
          className="gap-1.5"
        >
          <Filter className="h-4 w-4" />
          {copy.transactions.noCategory}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{copy.transactions.date}</th>
              <th className="text-left px-4 py-3 font-medium">{copy.transactions.description}</th>
              <th className="text-left px-4 py-3 font-medium">{copy.transactions.category}</th>
              <th className="text-right px-4 py-3 font-medium">{copy.transactions.amount}</th>
              <th className="text-left px-4 py-3 font-medium">{copy.transactions.notes}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  {copy.transactions.loading}
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  {copy.transactions.noMatches}
                </td>
              </tr>
            ) : (
              transactions.map(tx => (
                <tr
                  key={tx.id}
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedTx(tx)}
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(tx.fechaInicio)}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="truncate block">{tx.descripcion}</span>
                    {tx.isManual && (
                      <span className="text-xs text-muted-foreground">{copy.transactions.addManual}</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Select
                      value={tx.categoryId ?? 'none'}
                      onValueChange={val => updateCategory(tx.id, val === 'none' ? null : val)}
                    >
                      <SelectTrigger className="h-7 text-xs w-40 border-0 bg-transparent p-0 hover:bg-muted rounded-md px-2">
                        <SelectValue>
                          {tx.categoryId ? (
                            <span className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: tx.categoryColor ?? '#9CA3AF' }}
                              />
                              {tx.categoryName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{copy.transactions.noCategory}</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{copy.transactions.noCategory}</SelectItem>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: c.color }}
                              />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${tx.importe < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span className="flex items-center justify-end gap-1">
                      {tx.splitAnnual && (
                        <span title={copy.transactions.splitAnnualTitle}>
                          <CalendarClock className="h-3 w-3 text-blue-400 shrink-0" />
                        </span>
                      )}
                      {tx.budgetDate && (
                        <span title={`Imputado a ${tx.budgetDate.slice(0, 7)}`}>
                          <Calendar className="h-3 w-3 text-violet-400 shrink-0" />
                        </span>
                      )}
                      {formatCurrency(tx.importe)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                    {tx.notes}
                    {tx.excludeFromBudget && (
                      <Badge variant="outline" className="text-xs ml-1">{copy.editTx.excludeBudget}</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{copy.transactions.page} {page} {copy.transactions.of} {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setLoading(true)
              setPage(p => p - 1)
            }} disabled={page === 1}>
              {copy.transactions.of === 'de' ? 'Anterior' : 'Previous'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setLoading(true)
              setPage(p => p + 1)
            }} disabled={page === totalPages}>
              {copy.transactions.of === 'de' ? 'Siguiente' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      <AddTransactionDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        categories={categories}
        onSaved={() => {
          setLoading(true)
          loadTransactions()
        }}
      />

      {selectedTx && (
        <EditTransactionSheet
          transaction={selectedTx}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onSaved={() => {
            setSelectedTx(null)
            setLoading(true)
            loadTransactions()
          }}
        />
      )}
    </div>
  )
}
