import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { messages, users } from '@/lib/db/schema'
import { getMessagesForRoom, getRoomForViewer, getRoomReads, getSessionUserOrNull, markRoomRead } from '@/lib/server-data'

const CONTENT_MAX = 500

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const access = await getRoomForViewer(id, me.id)
  if (!access) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const afterRaw = new URL(request.url).searchParams.get('after')
  const after = Number(afterRaw ?? '0')

  const list = await getMessagesForRoom(id, Number.isFinite(after) ? after : 0, me.id)

  // 방을 조회했다는 건 읽었다는 뜻 — 방 종류 무관하게 내 커서를 올린다(채팅 목록 안읽음 수에 반영됨).
  await markRoomRead(id, me.id)

  // 참여자 전원의 읽음 커서 스냅샷(메시지별 안읽음 인원수 배지용)은 참여자 집합이 정해진 ORDER 방에서만 의미가 있다.
  let reads: Awaited<ReturnType<typeof getRoomReads>> = []
  if (access.type === 'ORDER' && access.pot) {
    reads = await getRoomReads(id, access.pot.id)
  }

  return NextResponse.json({ messages: list, reads })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const access = await getRoomForViewer(id, me.id)
  if (!access) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content || content.length > CONTENT_MAX) {
    return NextResponse.json({ error: '메시지를 확인해 주세요.' }, { status: 400 })
  }

  const db = getDb()

  // CHAT-15: 계정이 일시 정지(SUSPENDED) 또는 비활성화(DISABLED)된 사용자는 메시지 전송 불가
  const [userRow] = await db
    .select({ accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1)

  if (userRow?.accountStatus && userRow.accountStatus !== 'ACTIVE') {
    return NextResponse.json(
      { error: '계정이 일시 정지되거나 비활성화되어 메시지를 전송할 수 없습니다.' },
      { status: 403 },
    )
  }

  const [created] = await db
    .insert(messages)
    .values({ roomId: id, senderId: me.id, type: 'TEXT', content })
    .returning()

  // 내가 방금 보낸 메시지는 당연히 내가 읽은 것으로 처리(방 종류 무관)
  await markRoomRead(id, me.id)

  return NextResponse.json(
    {
      message: {
        id: String(created.id),
        roomId: created.roomId,
        senderId: created.senderId ?? '',
        senderNickname: me.nickname,
        type: created.type,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
        isMine: true,
      },
    },
    { status: 201 },
  )
}
