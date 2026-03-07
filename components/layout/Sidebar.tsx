'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Upload, List, PiggyBank, Tag, BarChart3, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from './ThemeToggle'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { useUiCopy } from '@/lib/ui-copy'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const settings = useAppSettings()
  const copy = useUiCopy()
  const navItems = [
    { href: '/dashboard', label: copy.nav.dashboard, icon: LayoutDashboard },
    { href: '/transacciones', label: copy.nav.transactions, icon: List },
    { href: '/presupuesto', label: copy.nav.budget, icon: PiggyBank },
    { href: '/categorias', label: copy.nav.categories, icon: Tag },
    { href: '/informes', label: copy.nav.reports, icon: BarChart3 },
    { href: '/importar', label: copy.nav.import, icon: Upload },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 border-r flex flex-col shrink-0 h-screen sticky top-0 bg-card">

      {/* ── Brand header ──────────────────────────────────────────── */}
      <Link href="/dashboard" className="px-4 py-5 border-b bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white tracking-tight leading-none">
              {settings.appName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white leading-tight">{settings.appName}</p>
            <p className="text-[11px] text-white/45 mt-0.5">{settings.householdName}</p>
          </div>
        </div>
      </Link>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150',
                active
                  ? 'bg-foreground/[0.07] text-foreground font-medium dark:bg-foreground/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {/* Left indicator bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-foreground/50" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'opacity-90' : 'opacity-45'
                )}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t bg-card">
        <ThemeToggle />
        <button
          type="button"
          onClick={handleLogout}
          className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          {copy.nav.signOut}
        </button>
      </div>
    </aside>
  )
}
