import { SettingsView } from '@/components/my/settings-view'
import { getCurrentUser } from '@/lib/server-data'

export default async function SettingsPage() {
  await getCurrentUser()
  return <SettingsView />
}
