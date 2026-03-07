import { redirect } from 'next/navigation'
import { getPublicAppSettings } from '@/lib/app-settings'

export default async function Home() {
  const settings = await getPublicAppSettings()
  redirect(settings.setupCompleted ? '/dashboard' : '/setup')
}
