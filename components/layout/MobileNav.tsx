'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, LayoutDashboard, Upload, List, PiggyBank, Tag, BarChart3, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { ThemeToggle } from './ThemeToggle'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { useUiCopy } from '@/lib/ui-copy'

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const settings = useAppSettings()
  const copy = useUiCopy()

  if (pathname === '/login' || pathname === '/setup') return null

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
    <Sheet>
      {/* ── Mobile header bar (hidden on md+) ──────────────────────────── */}
      <div className="md:hidden flex items-center justify-between h-14 px-4 border-b bg-card sticky top-0 z-40 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-white tracking-tight leading-none">
              {settings.appName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="font-semibold text-sm truncate">{settings.appName}</span>
        </Link>
        <SheetTrigger asChild>
          <button
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────────── */}
      <SheetContent side="left" showCloseButton={false} className="p-0 flex flex-col w-72">
        {/* Brand header */}
        <Link
          href="/dashboard"
          className="px-4 py-5 border-b bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 transition-colors shrink-0"
        >
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

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <SheetClose asChild key={href}>
                <Link
                  href={href}
                  className={cn(
                    'relative flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-all duration-150',
                    active
                      ? 'bg-foreground/[0.07] text-foreground font-medium dark:bg-foreground/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
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
              </SheetClose>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-card shrink-0">
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
      </SheetContent>
    </Sheet>
  )
}
