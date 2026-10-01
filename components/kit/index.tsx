'use client'

import { useId } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, monthName } from '@/lib/format'

/** Page title block: small-caps eyebrow, serif title, optional subtitle and actions. */
export function PageHeader({
  eyebrow, title, subtitle, actions, className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('animate-rise flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[34px] leading-[1.05] md:text-[42px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-[14px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Money with tabular figures; `tone` colors income/expense, `signed` forces a leading +. */
export function Money({
  amount, className, tone = false, signed = false,
}: {
  amount: number
  className?: string
  tone?: boolean
  signed?: boolean
}) {
  return (
    <span
      className={cn(
        'figures whitespace-nowrap',
        tone && (amount < 0 ? 'text-foreground' : amount > 0 ? 'text-positive' : 'text-muted-foreground'),
        className,
      )}
    >
      {signed && amount > 0 ? '+' : ''}
      {formatCurrency(amount)}
    </span>
  )
}

/** "Septiembre" from (2026, 9), capitalized for display. */
export function monthTitle(year: number, month: number) {
  const name = monthName(month, year)
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function MonthSwitcher({
  year, month, onPrev, onNext, onToday, canGoNext = true, todayLabel,
}: {
  year: number
  month: number
  onPrev: () => void
  onNext: () => void
  onToday?: () => void
  canGoNext?: boolean
  todayLabel?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="surface flex items-center gap-1 rounded-full p-1">
        <button type="button" onClick={onPrev} aria-label="Mes anterior"
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[9.5rem] text-center">
          <span className="font-display text-[17px]">{monthTitle(year, month)}</span>{' '}
          <span className="figures text-[13px] text-muted-foreground">{year}</span>
        </span>
        <button type="button" onClick={onNext} disabled={!canGoNext} aria-label="Mes siguiente"
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>
      {onToday && canGoNext && (
        <button type="button" onClick={onToday}
          className="rounded-full px-3 py-2 text-[12.5px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
          {todayLabel ?? 'Hoy'}
        </button>
      )}
    </div>
  )
}

/** Initial of a merchant on a disc tinted with its category color. */
export function MerchantAvatar({ name, color, size = 36 }: { name: string; color?: string | null; size?: number }) {
  const initial = (name.replace(/^(transferencia (de|a)|pago de|una recarga de)\s+/i, '').trim()[0] ?? '·').toUpperCase()
  const tint = color ?? 'var(--muted-foreground)'
  return (
    <span
      aria-hidden
      className="font-display grid shrink-0 place-items-center rounded-full text-[15px]"
      style={{
        width: size, height: size,
        background: `color-mix(in srgb, ${tint} 16%, var(--card))`,
        color: `color-mix(in srgb, ${tint} 78%, var(--foreground))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tint} 28%, transparent)`,
      }}
    >
      {initial}
    </span>
  )
}

/**
 * Thin progress meter. Past 100% the bar turns terracotta; callers pair it
 * with a status label so "over budget" never relies on color alone.
 */
export function Meter({
  value, max, color, marker, className,
}: {
  value: number
  max: number
  color?: string
  /** Optional 0..1 position of a tick, e.g. how much of the month has passed */
  marker?: number
  className?: string
}) {
  const pct = max > 0 ? value / max : 0
  const fill = Math.min(pct, 1) * 100
  const over = pct > 1
  return (
    <div className={cn('relative h-1.5 w-full rounded-full bg-muted', className)} role="meter"
      aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${fill}%`, background: over ? 'var(--terracotta)' : (color ?? 'var(--primary)') }}
      />
      {marker !== undefined && (
        <span
          aria-hidden
          className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-foreground/70"
          style={{ left: `calc(${Math.min(Math.max(marker, 0), 1) * 100}% - 1px)` }}
        />
      )}
    </div>
  )
}

/** Replaces {name} placeholders in a copy string. */
export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

/** Status label for a budget line: icon + word, so it never relies on color alone. */
export function StatusPill({ status, labels }: {
  status: 'ok' | 'warning' | 'over'
  labels: { ok: string; warning: string; over: string }
}) {
  const style = {
    ok: 'text-positive bg-positive/10',
    warning: 'text-warning bg-warning/12',
    over: 'text-negative bg-negative/10',
  }[status]
  const glyph = { ok: '●', warning: '▲', over: '■' }[status]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide', style)}>
      <span aria-hidden className="text-[7px] leading-none">{glyph}</span>
      {labels[status]}
    </span>
  )
}

/**
 * Cumulative spending through the month against an even pace to the budget.
 * The dashed diagonal is "spending evenly"; the solid line is what happened.
 * `upToDay` cuts the line at today for the current month.
 */
export function PaceChart({
  cumulative, budget, upToDay, labels, className,
}: {
  cumulative: number[]
  budget: number
  upToDay?: number
  labels: { budget: string; pace: string }
  className?: string
}) {
  const gradientId = useId()
  const days = cumulative.length
  if (days === 0) return null
  const shown = cumulative.slice(0, upToDay ?? days)
  const top = Math.max(budget, ...shown, 1) * 1.1
  const W = 600
  const H = 160
  const x = (dayIndex: number) => (days === 1 ? 0 : (dayIndex / (days - 1)) * W)
  const y = (amount: number) => H - (Math.max(amount, 0) / top) * H
  // Start from zero at day 1 so the first day's spending reads as a rise
  const points = [[0, H], ...shown.map((v, i) => [x(i), y(v)])]
  const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const lastX = x(shown.length - 1)
  const lastY = y(shown[shown.length - 1] ?? 0)
  const over = (shown[shown.length - 1] ?? 0) > budget
  const stroke = over ? 'var(--terracotta)' : 'var(--primary)'

  return (
    <div className={className}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-36 w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" x2={W} y1={y(budget)} y2={y(budget)} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={H} y2={y(budget)} stroke="var(--muted-foreground)" strokeOpacity="0.45" strokeWidth="1"
            strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d={`${line} L${lastX.toFixed(1)},${H} Z`} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          aria-hidden
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-card"
          style={{ left: `${(lastX / W) * 100}%`, top: `${(lastY / H) * 100}%`, background: stroke }}
        />
        <span className="eyebrow absolute right-0 -translate-y-full pb-1 text-[9.5px]" style={{ top: `${(y(budget) / H) * 100}%` }}>
          {labels.budget}
        </span>
      </div>
      <div className="figures mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>1</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-4 border-t border-dashed border-muted-foreground/60" />
          {labels.pace}
        </span>
        <span>{days}</span>
      </div>
    </div>
  )
}
