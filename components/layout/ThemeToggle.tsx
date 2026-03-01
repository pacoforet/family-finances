'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    applyTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="h-3.5 w-3.5" />
          Modo claro
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5" />
          Modo oscuro
        </>
      )}
    </button>
  )
}
