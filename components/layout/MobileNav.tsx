'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { NavPanel, householdMonogram } from './NavPanel'

export function MobileNav() {
  const settings = useAppSettings()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="font-display grid size-8 place-items-center rounded-full bg-primary text-[12px] italic text-primary-foreground">
            {householdMonogram(settings.householdName)}
          </span>
          <span className="font-display truncate text-[17px]">{settings.appName}</span>
        </Link>
        <SheetTrigger asChild>
          <button className="rounded-lg p-2 transition-colors hover:bg-muted" aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
        </SheetTrigger>
      </div>
      <SheetContent side="left" showCloseButton={false} className="w-72 border-0 p-0">
        <SheetTitle className="sr-only">Menú</SheetTitle>
        <NavPanel onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
