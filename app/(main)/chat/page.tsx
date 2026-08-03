import { ChatListView } from '@/components/chat/chat-list-view'
import { getCurrentUser, listRoomsForUser } from '@/lib/server-data'

export default async function ChatPage() {
  const me = await getCurrentUser()
  const rooms = await listRoomsForUser(me.id)

  const myRooms = rooms.filter((r) => r.type === 'ORDER')
  const communityRooms = rooms.filter((r) => r.type === 'COMMUNITY')

  return <ChatListView myRooms={myRooms} communityRooms={communityRooms} />
}
