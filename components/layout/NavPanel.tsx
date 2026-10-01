'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { useUiCopy } from '@/lib/ui-copy'
import { ThemeToggle } from './ThemeToggle'
import { useNavItems, useSignOut, useSuggestionCount } from './nav'

/** "Paco & Silvia" -> "P&S"; "Familia García" -> "FG" */
export function householdMonogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.includes('&') || words.includes('y')) {
    return words.filter(w => w !== '&' && w !== 'y').map(w => w[0]?.toUpperCase()).slice(0, 2).join('&')
  }
  return words.map(w => w[0]?.toUpperCase()).slice(0, 2).join('')
}

/**
 * Navigation column shared by the desktop sidebar and the mobile drawer:
 * the spine of the ledger, dark in both themes.
 */
export function NavPanel({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const settings = useAppSettings()
  const copy = useUiCopy()
  const navItems = useNavItems()
  const handleLogout = useSignOut()
  const pending = useSuggestionCount()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link href="/dashboard" onClick={onNavigate} className="group flex items-center gap-3 px-5 pt-7 pb-6">
        <span className="font-display grid size-11 shrink-0 place-items-center rounded-full border border-sidebar-primary/50 text-[15px] italic text-sidebar-primary transition-colors group-hover:bg-sidebar-primary group-hover:text-sidebar-primary-foreground">
          {householdMonogram(settings.householdName)}
        </span>
        <span className="min-w-0">
          <span className="font-display block truncate text-[17px] leading-tight text-sidebar-accent-foreground">{settings.appName}</span>
          <span className="block truncate text-[11px] tracking-wide text-sidebar-foreground/55">{settings.householdName}</span>
        </span>
      </Link>

      <div className="mx-5 h-px bg-sidebar-border" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Principal">
        {navItems.map(({ href, label, icon: Icon }, i) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const badge = href === '/transactions' && pending > 0 ? pending : null
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              style={{ animationDelay: `${60 + i * 40}ms` }}
              className={cn(
                'animate-rise relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )}
            >
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-opacity',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />
              <Icon className={cn('size-[17px] shrink-0', active ? 'text-sidebar-primary' : 'opacity-60')} strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="figures rounded-full bg-sidebar-primary px-1.5 py-px text-[10.5px] font-semibold text-sidebar-primary-foreground">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
          {copy.nav.signOut}
        </button>
      </div>
    </div>
  )
}
