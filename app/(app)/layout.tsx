import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { getPublicAppSettings } from '@/lib/app-settings'

/** Shell for the signed-in app. Until setup is done, every page redirects there. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicAppSettings()
  if (!settings.setupCompleted) redirect('/setup')

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
