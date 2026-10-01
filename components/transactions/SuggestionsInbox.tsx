'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Sparkles, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MerchantAvatar, Money, fill } from '@/components/kit'
import { formatDayMonth } from '@/lib/format'
import { fetchJson } from '@/lib/fetch-json'
import { useUiCopy } from '@/lib/ui-copy'
import type { Category } from '@/db/schema'

export interface Suggestion {
  id: string
  fechaInicio: string
  descripcion: string
  importe: number
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  suggestedCategoryColor: string | null
  suggestedExclude: boolean
  confidence: number | null
  source: 'rule' | 'merchant' | 'similar' | 'llm' | null
  reason: string | null
}

const EXCLUDE = '__exclude__'

/** Tells the nav badge and other listeners that the pending count changed. */
export function notifySuggestionsChanged() {
  window.dispatchEvent(new Event('suggestions-changed'))
}

/**
 * Review queue for categorization suggestions: each row can be accepted as is,
 * accepted with another category, or dismissed. Also runs the categorizer
 * (and Claude, when configured) over pending transactions.
 */
export function SuggestionsInbox({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const copy = useUiCopy()
  const t = copy.suggestions
  const [items, setItems] = useState<Suggestion[] | null>(null)
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [llmEnabled, setLlmEnabled] = useState(false)
  const [running, setRunning] = useState<'auto' | 'llm' | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const load = useCallback(() => {
    return fetchJson('/api/categorize/suggestions')
      .then(d => setItems(d.suggestions))
      .catch(() => { setItems([]); alert(copy.common.loadFailed) })
  }, [copy])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetchJson('/api/categorize/run').then(d => setLlmEnabled(Boolean(d.llmEnabled))).catch(() => {})
  }, [])

  const selected = (s: Suggestion) =>
    choice[s.id] ?? (s.suggestedCategoryId ?? (s.suggestedExclude ? EXCLUDE : ''))

  const resolve = async (s: Suggestion, action: 'accept' | 'dismiss') => {
    setBusy(s.id)
    try {
      const value = selected(s)
      const body = action === 'dismiss'
        ? { action }
        : value === EXCLUDE
          ? { action, exclude: true }
          : { action, categoryId: value || undefined }
      await fetchJson(`/api/categorize/suggestions/${s.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setItems(prev => prev?.filter(i => i.id !== s.id) ?? null)
      notifySuggestionsChanged()
      onChanged()
    } catch {
      alert(copy.common.requestFailed)
    } finally {
      setBusy(null)
    }
  }

  const acceptAll = async () => {
    if (!items?.length || !confirm(fill(t.acceptAllConfirm, { count: items.length }))) return
    for (const s of items) await resolve(s, 'accept')
  }

  const run = async (mode: 'auto' | 'llm') => {
    setRunning(mode)
    setResult(null)
    try {
      const r = await fetchJson('/api/categorize/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llm: mode === 'llm' }),
      })
      setResult(fill(t.runResult, r))
      await load()
      notifySuggestionsChanged()
      onChanged()
    } catch {
      alert(copy.common.requestFailed)
    } finally {
      setRunning(null)
    }
  }

  return (
    <section className="surface animate-rise overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 md:px-6">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brass/15 text-brass">
            <Sparkles className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[19px] leading-tight">{t.title}</h2>
            <p className="mt-1 max-w-lg text-[13px] text-muted-foreground">{t.body}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => run('auto')} disabled={running !== null}>
            <Wand2 className="size-4" />
            {running === 'auto' ? t.running : t.runAuto}
          </Button>
          {llmEnabled && (
            <Button variant="outline" size="sm" onClick={() => run('llm')} disabled={running !== null}>
              <Sparkles className="size-4" />
              {running === 'llm' ? t.asking : t.askClaude}
            </Button>
          )}
          {items && items.length > 1 && (
            <Button size="sm" onClick={acceptAll} disabled={busy !== null || running !== null}>
              <Check className="size-4" />
              {t.acceptAll}
            </Button>
          )}
        </div>
        {result && <p className="w-full text-[12.5px] text-muted-foreground" role="status">{result}</p>}
      </div>

      {items === null ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">{copy.transactions.loading}</p>
      ) : items.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {items.map(s => (
            <li key={s.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <MerchantAvatar name={s.descripcion} color={s.suggestedCategoryColor} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{s.descripcion}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
                    <span>{formatDayMonth(s.fechaInicio)}</span>
                    {s.source && (
                      <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-semibold text-foreground/70">
                        {t.sources[s.source]}
                      </span>
                    )}
                    {s.reason && <span className="truncate">{s.reason}</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <Money amount={s.importe} tone signed className="w-24 text-right text-[13.5px] font-semibold" />
                <ConfidenceDots value={s.confidence} label={t.confidence} />
                <Select value={selected(s)} onValueChange={v => setChoice(c => ({ ...c, [s.id]: v }))}>
                  <SelectTrigger className="h-9 w-44 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value={EXCLUDE}>{t.exclude}</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" className="size-9 shrink-0" aria-label={t.accept} title={t.accept}
                  onClick={() => resolve(s, 'accept')} disabled={busy === s.id || !selected(s)}>
                  <Check className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="size-9 shrink-0" aria-label={t.dismiss} title={t.dismiss}
                  onClick={() => resolve(s, 'dismiss')} disabled={busy === s.id}>
                  <X className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Three dots filled by confidence, with the percentage for screen readers and on hover. */
function ConfidenceDots({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null
  const filled = value >= 0.6 ? 3 : value >= 0.45 ? 2 : 1
  const pct = `${Math.round(value * 100)}%`
  return (
    <span className="hidden items-center gap-0.5 sm:flex" title={`${label}: ${pct}`}>
      <span className="sr-only">{`${label}: ${pct}`}</span>
      {[0, 1, 2].map(i => (
        <span key={i} aria-hidden className={i < filled ? 'size-1.5 rounded-full bg-brass' : 'size-1.5 rounded-full bg-border'} />
      ))}
    </span>
  )
}
