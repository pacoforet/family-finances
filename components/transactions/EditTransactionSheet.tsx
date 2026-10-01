'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate, formatMonthYear, monthName, parseDateParts } from '@/lib/format'
import { Ban, Tag, CalendarClock, CheckCircle2, Calendar } from 'lucide-react'
import type { Category } from '@/db/schema'
import { useUiCopy } from '@/lib/ui-copy'
import { fetchJson } from '@/lib/fetch-json'

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
  // Calendar date as stored, so the browser timezone cannot shift the month
  const txDate    = parseDateParts(tx.fechaInicio) ?? (() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
  })()
  const [budgetDateActive, setBudgetDateActive] = useState(!!initialBD)
  const [budgetMonth, setBudgetMonth] = useState(() => {
    if (initialBD) return initialBD.month
    // Default: next month after the transaction
    return txDate.month === 12 ? 1 : txDate.month + 1
  })
  const [budgetYear, setBudgetYear] = useState(() => {
    if (initialBD) return initialBD.year
    return txDate.month === 12 ? txDate.year + 1 : txDate.year
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
            ? `${budgetYear}-${String(budgetMonth).padStart(2, '0')}-01`
            : null,
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
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
      await fetchJson(`/api/transactions/${tx.id}`, { method: 'DELETE' })
      onSaved()
    } catch {
      setError(copy.common.requestFailed)
    } finally {
      setDeleting(false)
    }
  }

  const visibleCategories = categories

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-sm">

        {/* Accessible title for screen readers */}
        <SheetTitle className="sr-only">{copy.editTx.title}</SheetTitle>

        {/* ─── HEADER ───────────────────────────────────────── */}
        <div
          className="relative overflow-hidden border-b bg-paper-deep px-6 pt-9 pb-7"
        >
          <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${isExpense ? 'bg-terracotta' : 'bg-positive'}`} />
          <p className="eyebrow mb-2">
            {isExpense ? copy.editTx.expense : copy.editTx.income}
          </p>
          <p className={`font-display figures mb-4 text-[40px] leading-none ${isExpense ? '' : 'text-positive'}`}>
            {formatCurrency(tx.importe)}
          </p>
          <p className="mb-1 line-clamp-2 text-sm font-medium leading-snug">
            {tx.descripcion}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(tx.fechaInicio)}</p>
        </div>

        {/* ─── SCROLLABLE BODY ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* AUTO-CAT + RULE NOTIFICATION */}
          {(autoCatCount !== null || ruleSaved) && (
            <div className="rounded-xl border border-positive/30 bg-positive/10 px-3.5 py-2.5 space-y-1.5">
              {ruleSaved && (
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
                  <p className="text-xs font-medium text-positive">
                    {copy.editTx.savedRule} &quot;{tx.descripcion}&quot; → {categories.find(c => c.id === categoryId)?.name}
                  </p>
                </div>
              )}
              {autoCatCount !== null && (
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-positive shrink-0" />
                  <p className="text-xs font-medium text-positive">
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
                    ? 'border-foreground/40 bg-muted'
                    : 'border-border hover:bg-muted/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
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
              className="resize-none text-base md:text-sm"
            />
          </div>

          {/* SPLIT ANNUAL TOGGLE */}
          <button
            type="button"
            onClick={() => setSplitAnnual(!splitAnnual)}
            className={`w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
              splitAnnual
                ? 'border-primary/40 bg-accent'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <CalendarClock className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${splitAnnual ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${splitAnnual ? 'text-accent-foreground' : ''}`}>
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
                splitAnnual ? 'bg-primary' : 'bg-input'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-card rounded-full shadow-sm transition-transform duration-200 ${
                  splitAnnual ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>

          {/* BUDGET DATE OVERRIDE */}
          <div className={`rounded-xl border transition-colors duration-150 ${
            budgetDateActive
              ? 'border-brass/50 bg-brass/10'
              : 'border-border hover:bg-muted/40'
          }`}>
            <button
              type="button"
              onClick={() => setBudgetDateActive(v => !v)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Calendar className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${budgetDateActive ? 'text-brass' : 'text-muted-foreground'}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium leading-tight ${budgetDateActive ? 'text-foreground' : ''}`}>
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
                budgetDateActive ? 'bg-brass' : 'bg-input'
              }`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-card rounded-full shadow-sm transition-transform duration-200 ${
                  budgetDateActive ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </div>
            </button>
            {budgetDateActive && (
              <div className="flex gap-2 px-4 pb-3">
                <select
                  value={budgetMonth}
                  onChange={e => setBudgetMonth(parseInt(e.target.value))}
                  className="flex-1 text-base md:text-sm rounded-md border border-brass/40 px-2 py-1.5 bg-background text-foreground focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>{monthName(i + 1)}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={budgetYear}
                  onChange={e => setBudgetYear(parseInt(e.target.value))}
                  className="w-20 text-base md:text-sm rounded-md border border-brass/40 px-2 py-1.5 bg-background text-foreground focus:outline-none"
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
                ? 'border-warning/40 bg-warning/10'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Ban className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${exclude ? 'text-warning' : 'text-muted-foreground'}`} />
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${exclude ? 'text-foreground' : ''}`}>
                  {copy.editTx.excludeBudget}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {copy.editTx.excludeHint}
                </p>
              </div>
            </div>
            <div
              className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${
                exclude ? 'bg-warning' : 'bg-input'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-card rounded-full shadow-sm transition-transform duration-200 ${
                  exclude ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>

          {/* Error */}
          {error && (
            <p className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-xs text-negative">
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
              className="w-full text-center text-xs text-muted-foreground/70 hover:text-negative transition-colors py-1"
            >
              {copy.editTx.deleteTransaction}
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-negative/30 bg-negative/10 px-3 py-3">
              <p className="text-center text-xs font-medium text-negative">
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
