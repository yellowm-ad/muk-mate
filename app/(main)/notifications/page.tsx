import { NotificationsView } from '@/components/notifications-view'
import { getCurrentUser, getNotificationsForUser } from '@/lib/server-data'

export default async function NotificationsPage() {
  const me = await getCurrentUser()
  const { items } = await getNotificationsForUser(me.id, undefined, 50)

  return <NotificationsView initialNotifications={items} />
}
