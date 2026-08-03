import { and, count, eq, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { chatRooms, messages, participations, pots } from '@/lib/db/schema'
import { createNotificationBulk } from '@/lib/notifications'
import { cancelPotAndNotify, computeEffectiveStatus, getPotById, getSessionUserOrNull } from '@/lib/server-data'
import type { PotStatus } from '@/lib/types'

// PRD §5-1 상태 전이: OPEN → CLOSED → ORDERED, 그리고 (OPEN|CLOSED) → CANCELED.
// ORDERED/CANCELED는 종료 상태 — 더 이상 전이하지 않는다.
const ALLOWED_TRANSITIONS: Record<PotStatus, PotStatus[]> = {
  OPEN: ['CLOSED', 'CANCELED'],
  CLOSED: ['ORDERED', 'CANCELED'],
  ORDERED: [],
  CANCELED: [],
}

// CANCELED는 cancelPotAndNotify()가 시스템 메시지까지 함께 처리한다.
const STATUS_SYSTEM_MESSAGE: Partial<Record<PotStatus, string>> = {
  CLOSED: '모집이 마감되었습니다.',
  ORDERED: '주문이 완료되었습니다.',
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pot = await getPotById(id)
  if (!pot) {
    return NextResponse.json({ error: '존재하지 않는 공동주문입니다.' }, { status: 404 })
  }
  return NextResponse.json(pot)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const nextStatus = body?.status as PotStatus | undefined

  if (!nextStatus || !(nextStatus in ALLOWED_TRANSITIONS)) {
    return NextResponse.json({ error: '올바르지 않은 상태 값입니다.' }, { status: 400 })
  }

  const db = getDb()
  const [row] = await db
    .select({ hostId: pots.hostId, status: pots.status, deadlineAt: pots.deadlineAt, storeName: pots.storeName })
    .from(pots)
    .where(eq(pots.id, id))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: '존재하지 않는 공동주문입니다.' }, { status: 404 })
  }
  if (row.hostId !== me.id) {
    return NextResponse.json({ error: '모집자만 상태를 변경할 수 있습니다.' }, { status: 403 })
  }

  const currentEffective = computeEffectiveStatus(row.status, row.deadlineAt)
  if (!ALLOWED_TRANSITIONS[currentEffective].includes(nextStatus)) {
    return NextResponse.json(
      { error: `${currentEffective} 상태에서는 ${nextStatus}로 변경할 수 없습니다.` },
      { status: 409 },
    )
  }

  if (nextStatus === 'CANCELED') {
    // 취소는 회원 탈퇴 자동 취소와 로직을 공유한다 (lib/server-data.ts의 cancelPotAndNotify)
    await cancelPotAndNotify(id, row.storeName, me.id)
    const pot = await getPotById(id)
    return NextResponse.json({ pot })
  }

  await db.update(pots).set({ status: nextStatus }).where(eq(pots.id, id))

  const systemMessage = STATUS_SYSTEM_MESSAGE[nextStatus]
  if (systemMessage) {
    const [room] = await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.potId, id)).limit(1)
    if (room) {
      await db.insert(messages).values({ roomId: room.id, senderId: null, type: 'SYSTEM', content: systemMessage })
    }
  }

  // 🔔 알림 훅: ORDERED 상태 변경 알림
  if (nextStatus === 'ORDERED') {
    const approvedMembers = await db
      .select({ userId: participations.userId })
      .from(participations)
      .where(and(eq(participations.potId, id), eq(participations.approvalStatus, 'APPROVED')))

    const recipients = approvedMembers.map((m) => m.userId).filter((uid) => uid !== me.id)
    await createNotificationBulk(
      db,
      recipients.map((uid) => ({
        recipientId: uid,
        type: 'POT_COMPLETED',
        potId: id,
        title: '공동주문이 완료되었어요',
        body: `${row.storeName} 공동주문이 완료 처리되었어요.`,
        actionPath: `/pots/${id}`,
        dedupeKey: `POT_COMPLETED:${id}:${uid}`,
      })),
    )
  }

  const pot = await getPotById(id)
  return NextResponse.json({ pot })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()

  const [row] = await db.select({ hostId: pots.hostId }).from(pots).where(eq(pots.id, id)).limit(1)
  if (!row) {
    return NextResponse.json({ code: 'POT_NOT_FOUND', error: '존재하지 않는 모집글입니다.' }, { status: 404 })
  }
  if (row.hostId !== me.id) {
    return NextResponse.json({ code: 'FORBIDDEN', error: '모집자만 삭제할 수 있습니다.' }, { status: 403 })
  }

  // 참여 신청(대기중 포함) 1건이라도 있으면 삭제 불가.
  // 방장 본인도 모집글 생성 시 APPROVED 참여자로 함께 등록되므로(POST /api/pots) 집계에서 제외한다.
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(participations)
    .where(and(eq(participations.potId, id), ne(participations.userId, me.id)))
  if (cnt > 0) {
    return NextResponse.json(
      { code: 'HAS_PARTICIPANTS', error: '참여 신청이 있는 모집글은 삭제할 수 없습니다.' },
      { status: 409 },
    )
  }

  await db.delete(pots).where(eq(pots.id, id))

  return NextResponse.json({ ok: true })
}
