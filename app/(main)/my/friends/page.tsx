import { FriendsView } from '@/components/my/friends-view'
import { getCurrentUser, listFriends, listIncomingFriendRequests } from '@/lib/server-data'

export default async function FriendsPage() {
  const me = await getCurrentUser()
  const [friends, requests] = await Promise.all([listFriends(me.id), listIncomingFriendRequests(me.id)])

  return <FriendsView initialFriends={friends} initialRequests={requests} />
}
