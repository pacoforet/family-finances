import { redirect } from 'next/navigation'
import { getPublicAppSettings } from '@/lib/app-settings'

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicAppSettings()
  if (settings.setupCompleted) redirect('/dashboard')
  return children
}
