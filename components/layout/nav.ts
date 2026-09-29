'use client'

import { useRouter } from 'next/navigation'
import { LayoutDashboard, Upload, List, PiggyBank, Tag, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUiCopy } from '@/lib/ui-copy'

/** Main navigation shared by the desktop sidebar and the mobile menu. */
export function useNavItems() {
  const copy = useUiCopy()
  return [
    { href: '/dashboard', label: copy.nav.dashboard, icon: LayoutDashboard },
    { href: '/transactions', label: copy.nav.transactions, icon: List },
    { href: '/budget', label: copy.nav.budget, icon: PiggyBank },
    { href: '/categories', label: copy.nav.categories, icon: Tag },
    { href: '/reports', label: copy.nav.reports, icon: BarChart3 },
    { href: '/import', label: copy.nav.import, icon: Upload },
  ]
}

export function useSignOut() {
  const router = useRouter()
  return async () => {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }
}
