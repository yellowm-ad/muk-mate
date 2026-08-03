import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { messages, reports, users } from '@/lib/db/schema'
import { getRoomForViewer, getSessionUserOrNull } from '@/lib/server-data'

const REASON_SET = new Set([
  'HARASSMENT',
  'SEXUAL_CONTENT',
  'SPAM',
  'FRAUD',
  'NO_SHOW',
  'PRIVACY',
  'UNSAFE_MEETING',
  'OTHER',
])

export async function POST(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  const reportedUserId = typeof body.reportedUserId === 'string' ? body.reportedUserId : ''
  const roomId = typeof body.roomId === 'string' ? body.roomId : undefined
  const messageId = Number.isInteger(Number(body.messageId)) && Number(body.messageId) > 0 ? Number(body.messageId) : undefined
  const reason = typeof body.reason === 'string' ? body.reason : ''
  const detail = typeof body.detail === 'string' ? body.detail.trim() : ''

  if (!reportedUserId) {
    return NextResponse.json({ error: '신고 대상자를 선택해 주세요.' }, { status: 400 })
  }

  if (me.id === reportedUserId) {
    return NextResponse.json({ error: '자기 자신을 신고할 수 없습니다.' }, { status: 400 })
  }

  if (!reason || !REASON_SET.has(reason)) {
    return NextResponse.json({ error: '올바른 신고 사유를 선택해 주세요.' }, { status: 400 })
  }

  if (reason === 'OTHER' && !detail) {
    return NextResponse.json({ error: "'기타' 사유 선택 시 상세 내용을 작성해 주세요." }, { status: 400 })
  }

  const db = getDb()

  // 1. 신고 대상 사용자 존재 여부 확인
  const [reportedUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, reportedUserId)).limit(1)
  if (!reportedUser) {
    return NextResponse.json({ error: '존재하지 않는 사용자입니다.' }, { status: 404 })
  }

  // 2. 채팅방 접근 권한 검사
  if (roomId) {
    const access = await getRoomForViewer(roomId, me.id)
    if (!access) {
      return NextResponse.json({ error: '해당 채팅방에 접근할 권한이 없습니다.' }, { status: 403 })
    }
  }

  let messageContentSnapshot: string | null = null
  let messageCreatedSnapshot: Date | null = null

  // 3. 신고 대상 메시지 및 중복 신고 확인
  if (messageId) {
    const [msgRow] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)
    if (!msgRow) {
      return NextResponse.json({ error: '존재하지 않는 메시지입니다.' }, { status: 404 })
    }
    if (roomId && msgRow.roomId !== roomId) {
      return NextResponse.json({ error: '해당 채팅방의 메시지가 아닙니다.' }, { status: 400 })
    }
    if (msgRow.senderId !== reportedUserId) {
      return NextResponse.json({ error: '신고 대상자의 메시지가 아닙니다.' }, { status: 400 })
    }

    messageContentSnapshot = msgRow.content
    messageCreatedSnapshot = msgRow.createdAt

    const [existingReport] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.reporterId, me.id), eq(reports.messageId, messageId)))
      .limit(1)

    if (existingReport) {
      return NextResponse.json({ error: '이미 신고한 메시지입니다.' }, { status: 409 })
    }
  }

  // 4. 신고 접수 DB 등록
  const [created] = await db
    .insert(reports)
    .values({
      reporterId: me.id,
      reportedUserId,
      roomId: roomId || null,
      messageId: messageId || null,
      reason: reason as any,
      detail: detail || null,
      messageContentSnapshot,
      messageCreatedSnapshot,
      status: 'PENDING',
    })
    .returning({ id: reports.id })

  return NextResponse.json({ ok: true, reportId: created.id }, { status: 201 })
}
