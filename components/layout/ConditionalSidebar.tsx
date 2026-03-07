'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

export function ConditionalSidebar() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/setup') {
    return null
  }

  return <Sidebar />
}
