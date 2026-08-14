import { NotificationSettingsView } from '@/components/my/notification-settings-view'
import { getCurrentUser, getMyPreferences } from '@/lib/server-data'

export default async function NotificationSettingsPage() {
  const me = await getCurrentUser()
  const prefs = await getMyPreferences(me.id)
  return (
    <NotificationSettingsView
      initial={{
        potNotificationsEnabled: prefs.potNotificationsEnabled,
        friendNotificationsEnabled: prefs.friendNotificationsEnabled,
      }}
    />
  )
}
