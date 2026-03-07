'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate, formatMonthYear, monthName } from '@/lib/format'
import { Ban, Tag, CalendarClock, CheckCircle2, Calendar } from 'lucide-react'
import type { Category } from '@/db/schema'
import { useUiCopy } from '@/lib/ui-copy'

interface TxWithCategory {
  id: string
  fechaInicio: string
  descripcion: string
  importe: number
  categoryId: string | null
  categoryName: string | null
  notes: string | null
  isManual: boolean
  excludeFromBudget: boolean
  splitAnnual: boolean
  budgetDate: string | null
  state: string | null
}

function parseBudgetDate(bd: string | null): { year: number; month: number } | null {
  if (!bd) return null
  const m = bd.match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  return { year: parseInt(m[1]), month: parseInt(m[2]) }
}

interface Props {
  transaction: TxWithCategory
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

/** Convert #rrggbb → "r, g, b" for rgba() usage */
function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m
    ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`
    : '0, 0, 0'
}

export function EditTransactionSheet({ transaction: tx, categories, onClose, onSaved }: Props) {
  const copy = useUiCopy()
  const [categoryId, setCategoryId]         = useState(tx.categoryId ?? 'none')
  const [notes, setNotes]                   = useState(tx.notes ?? '')
  const [exclude, setExclude]               = useState(tx.excludeFromBudget)
  const [splitAnnual, setSplitAnnual]       = useState(tx.splitAnnual ?? false)
  const [saving, setSaving]                 = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [error, setError]                   = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // Auto-categorize notification: null = none, number = count categorized
  const [autoCatCount, setAutoCatCount]     = useState<number | null>(null)
  const [ruleSaved, setRuleSaved]           = useState(false)

  // Budget date override (imputar a otro mes)
  const initialBD = parseBudgetDate(tx.budgetDate ?? null)
  const txDate    = new Date(tx.fechaInicio)
  const [budgetDateActive, setBudgetDateActive] = useState(!!initialBD)
  const [budgetMonth, setBudgetMonth] = useState(() => {
    if (initialBD) return initialBD.month
    // Default: next month after the transaction
    return txDate.getMonth() === 11 ? 1 : txDate.getMonth() + 2
  })
  const [budgetYear, setBudgetYear] = useState(() => {
    if (initialBD) return initialBD.year
    return txDate.getMonth() === 11 ? txDate.getFullYear() + 1 : txDate.getFullYear()
  })

  const isExpense = tx.importe < 0

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setAutoCatCount(null)
    setRuleSaved(false)

    try {
      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: categoryId === 'none' ? null : categoryId,
          notes: notes || null,
          excludeFromBudget: exclude,
          splitAnnual,
          budgetDate: budgetDateActive
            ? `${budgetYear}-${String(budgetMonth).padStart(2, '0')}-01 00:00:00`
            : null,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? copy.addTx.saveError)
        return
      }

      // Auto-categorize + memorize: if a category was assigned, apply it to all
      // uncategorized transactions with the same description, and save a mapping rule
      if (categoryId !== 'none' && categoryId !== (tx.categoryId ?? 'none')) {
        const [bulkRes, ruleRes] = await Promise.all([
          fetch('/api/transactions/bulk-categorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: tx.descripcion, categoryId }),
          }),
          fetch('/api/mapping-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchType: 'exact',
              matchValue: tx.descripcion,
              categoryId,
            }),
          }),
        ])

        let updated = 0
        if (bulkRes.ok) {
          const data = await bulkRes.json()
          updated = data.updated ?? 0
        }
        const ruleOk = ruleRes.ok

        if (updated > 0 || ruleOk) {
          if (updated > 0) setAutoCatCount(updated)
          if (ruleOk) setRuleSaved(true)
          setTimeout(() => onSaved(), 1800)
          return
        }
      }

      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/transactions/${tx.id}`, { method: 'DELETE' })
      onSaved()
    } finally {
      setDeleting(false)
    }
  }

  const visibleCategories = categories

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent className="p-0 gap-0 flex flex-col sm:max-w-sm overflow-hidden">

        {/* Accessible title for screen readers */}
        <SheetTitle className="sr-only">{copy.editTx.title}</SheetTitle>

        {/* ─── HEADER ───────────────────────────────────────── */}
        <div
          className={`relative px-6 pt-8 pb-7 overflow-hidden ${
            isExpense
              ? 'bg-gradient-to-br from-red-500 to-rose-700'
              : 'bg-gradient-to-br from-emerald-400 to-green-600'
          }`}
        >
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-10 -right-2 w-24 h-24 rounded-full bg-white/5" />

          <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-1.5">
            {isExpense ? copy.editTx.expense : copy.editTx.income}
          </p>
          <p className="text-white text-4xl font-bold font-mono tracking-tight leading-none mb-4">
            {formatCurrency(tx.importe)}
          </p>
          <p className="text-white/90 text-sm font-medium leading-snug line-clamp-2 mb-1">
            {tx.descripcion}
          </p>
          <p className="text-white/55 text-xs">{formatDate(tx.fechaInicio)}</p>
        </div>

        {/* ─── SCROLLABLE BODY ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* AUTO-CAT + RULE NOTIFICATION */}
          {(autoCatCount !== null || ruleSaved) && (
            <div className="rounded-xl bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 px-3.5 py-2.5 space-y-1.5">
              {ruleSaved && (
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-800 dark:text-green-300 font-medium">
                    {copy.editTx.savedRule} &quot;{tx.descripcion}&quot; → {categories.find(c => c.id === categoryId)?.name}
                  </p>
                </div>
              )}
              {autoCatCount !== null && (
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-800 dark:text-green-300 font-medium">
                    {copy.editTx.alsoUpdated} {autoCatCount} {copy.editTx.moreTransactions}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CATEGORY PILLS */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <Tag className="h-3 w-3" />
              {copy.editTx.category}
            </div>
            <div className="grid grid-cols-2 gap-1.5">

              {/* "No category" pill */}
              <button
                onClick={() => setCategoryId('none')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all duration-150 ${
                  categoryId === 'none'
                    ? 'border-gray-400 bg-gray-100 dark:bg-gray-800'
                    : 'border-border hover:bg-muted/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                <span className="text-xs font-medium truncate text-muted-foreground">{copy.editTx.noCategory}</span>
              </button>

              {visibleCategories.map(cat => {
                const selected = categoryId === cat.id
                const rgb = hexToRgb(cat.color)
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all duration-150 hover:brightness-95"
                    style={{
                      borderColor: selected ? cat.color : undefined,
                      backgroundColor: selected ? `rgba(${rgb}, 0.12)` : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: selected ? cat.color : undefined }}
                    >
                      {cat.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* NOTES */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {copy.editTx.notes}
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={copy.editTx.addNote}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* SPLIT ANNUAL TOGGLE */}
          <button
            type="button"
            onClick={() => setSplitAnnual(!splitAnnual)}
            className={`w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
              splitAnnual
                ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <CalendarClock className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${splitAnnual ? 'text-blue-600' : 'text-muted-foreground'}`} />
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${splitAnnual ? 'text-blue-800 dark:text-blue-300' : ''}`}>
                  {copy.editTx.spread}{splitAnnual && <span className="ml-1.5 text-xs font-normal opacity-70">(÷12 = {formatCurrency(Math.abs(tx.importe) / 12)}{copy.editTx.perMonth})</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {copy.editTx.annualHint}
                </p>
              </div>
            </div>
            {/* Toggle switch */}
            <div
              className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${
                splitAnnual ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  splitAnnual ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>

          {/* BUDGET DATE OVERRIDE */}
          <div className={`rounded-xl border transition-colors duration-150 ${
            budgetDateActive
              ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30'
              : 'border-border hover:bg-muted/40'
          }`}>
            <button
              type="button"
              onClick={() => setBudgetDateActive(v => !v)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Calendar className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${budgetDateActive ? 'text-violet-600' : 'text-muted-foreground'}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium leading-tight ${budgetDateActive ? 'text-violet-800 dark:text-violet-300' : ''}`}>
                    {copy.editTx.assignAnotherMonth}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {budgetDateActive
                      ? `${copy.editTx.trackedIn} ${formatMonthYear(budgetYear, budgetMonth)}`
                      : copy.editTx.autoMonth}
                  </p>
                </div>
              </div>
              <div className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${
                budgetDateActive ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  budgetDateActive ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </div>
            </button>
            {budgetDateActive && (
              <div className="flex gap-2 px-4 pb-3">
                <select
                  value={budgetMonth}
                  onChange={e => setBudgetMonth(parseInt(e.target.value))}
                  className="flex-1 text-sm rounded-md border border-violet-200 dark:border-violet-700 px-2 py-1.5 bg-background text-violet-800 dark:text-violet-300 focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>{monthName(i + 1)}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={budgetYear}
                  onChange={e => setBudgetYear(parseInt(e.target.value))}
                  className="w-20 text-sm rounded-md border border-violet-200 dark:border-violet-700 px-2 py-1.5 bg-background text-violet-800 dark:text-violet-300 focus:outline-none"
                  min={2020}
                  max={2035}
                />
              </div>
            )}
          </div>

          {/* EXCLUDE TOGGLE */}
          <button
            type="button"
            onClick={() => setExclude(!exclude)}
            className={`w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
              exclude
                ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Ban className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${exclude ? 'text-amber-600' : 'text-muted-foreground'}`} />
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${exclude ? 'text-amber-800 dark:text-amber-300' : ''}`}>
                  {copy.editTx.excludeBudget}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {copy.editTx.excludeHint}
                </p>
              </div>
            </div>
            <div
              className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${
                exclude ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  exclude ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* ─── FOOTER ───────────────────────────────────────── */}
        <div className="border-t bg-background px-5 pt-3 pb-5 space-y-2 shrink-0">
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || autoCatCount !== null}
              className="flex-1 h-10"
            >
              {saving ? copy.editTx.saving : copy.editTx.saveChanges}
            </Button>
            <Button variant="outline" onClick={onClose} className="h-10 px-4">
              {copy.editTx.cancel}
            </Button>
          </div>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-center text-xs text-muted-foreground/70 hover:text-red-500 transition-colors py-1"
            >
              {copy.editTx.deleteTransaction}
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-3 py-3 space-y-2">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium text-center">
                {copy.editTx.deleteConfirm}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-8 text-xs"
                >
                  {deleting ? copy.editTx.deleting : copy.editTx.yesDelete}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 h-8 text-xs"
                >
                  {copy.editTx.cancel}
                </Button>
              </div>
            </div>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
