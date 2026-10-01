'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useUiCopy } from '@/lib/ui-copy'

type Theme = 'light' | 'dark'

// The theme lives in the <html> class (set before paint by the root layout script)
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}
const readTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

export function ThemeToggle() {
  const copy = useUiCopy()
  const theme = useSyncExternalStore<Theme | null>(subscribe, readTheme, () => null)

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try { localStorage.setItem('theme', next) } catch {}
  }

  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      aria-label={isDark ? copy.nav.switchToLight : copy.nav.switchToDark}
    >
      {isDark ? <Sun className="size-4" strokeWidth={1.75} /> : <Moon className="size-4" strokeWidth={1.75} />}
      {isDark ? copy.nav.lightMode : copy.nav.darkMode}
    </button>
  )
}
