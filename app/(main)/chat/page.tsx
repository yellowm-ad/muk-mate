import { ChatListView } from '@/components/chat/chat-list-view'
import { getCurrentUser, listRoomsForUser } from '@/lib/server-data'

export default async function ChatPage() {
  const me = await getCurrentUser()
  const rooms = await listRoomsForUser(me.id)

  // 친구 DM(신규)도 "개인 대화"라는 점에서 주문 채팅과 함께 "내 채팅" 탭에 묶는다 — COMMUNITY만 별도.
  const myRooms = rooms.filter((r) => r.type === 'ORDER' || r.type === 'DM')
  const communityRooms = rooms.filter((r) => r.type === 'COMMUNITY')

  return <ChatListView myRooms={myRooms} communityRooms={communityRooms} />
}
