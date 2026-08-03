import { notFound } from 'next/navigation'
import { ChatRoomView } from '@/components/chat/chat-room-view'
import {
  getCurrentUser,
  getMessagesForRoom,
  getMyReadCursor,
  getRoomForViewer,
  getRoomReads,
  markRoomRead,
} from '@/lib/server-data'
import type { RoomReadEntry } from '@/lib/types'

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentUser()

  // CHAT-01: 승인되지 않은 사용자는 URL을 직접 입력해도 접근 불가 — 여기서 서버가 막는다.
  const access = await getRoomForViewer(id, me.id)
  if (!access) notFound()

  const initialMessages = await getMessagesForRoom(id, 0, me.id)

  // 스크롤 복원용 — "이번 방문 이전까지" 읽은 지점을 markRoomRead()로 커서를 올리기 전에 먼저 잡아둔다.
  const initialReadCursor = await getMyReadCursor(id, me.id)

  // 방을 열어봤다는 건 읽었다는 뜻 — 방 종류 무관하게 내 커서를 올린다(채팅 목록 안읽음 수에 반영됨).
  await markRoomRead(id, me.id)

  let initialReads: RoomReadEntry[] = []
  if (access.type === 'ORDER' && access.pot) {
    initialReads = await getRoomReads(id, access.pot.id)
  }

  return (
    <ChatRoomView
      room={access}
      initialMessages={initialMessages}
      initialReads={initialReads}
      initialReadCursor={initialReadCursor}
    />
  )
}
