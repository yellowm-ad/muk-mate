import { FriendSettingsView } from '@/components/my/friend-settings-view'
import { getCurrentUser, getMyPreferences, listBlockedUsers } from '@/lib/server-data'

export default async function FriendSettingsPage() {
  const me = await getCurrentUser()
  const [blocked, prefs] = await Promise.all([listBlockedUsers(me.id), getMyPreferences(me.id)])
  return <FriendSettingsView initialBlocked={blocked} initialAutoAccept={prefs.autoAcceptFriendRequests} />
}
