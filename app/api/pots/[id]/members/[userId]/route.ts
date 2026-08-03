import { and, count, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { chatRooms, messages, participations, pots, users } from '@/lib/db/schema'
import { createNotification } from '@/lib/notifications'
import { getSessionUserOrNull } from '@/lib/server-data'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id: potId, userId: targetUserId } = await params
  const body = await request.json().catch(() => ({}))
  const rawAction = typeof body?.action === 'string' ? body.action.toLowerCase() : ''
  const action = rawAction === 'approve' || rawAction === 'approve' ? 'approve' : rawAction === 'reject' ? 'reject' : null

  if (!action) {
    return NextResponse.json({ code: 'INVALID_ACTION', error: '올바르지 않은 요청 액션입니다.' }, { status: 400 })
  }

  const db = getDb()

  // 1. 모집글 정보 및 방장 권한 검증
  const [pot] = await db
    .select({ id: pots.id, hostId: pots.hostId, targetValue: pots.targetValue, storeName: pots.storeName })
    .from(pots)
    .where(eq(pots.id, potId))
    .limit(1)

  if (!pot) {
    return NextResponse.json({ code: 'POT_NOT_FOUND', error: '존재하지 않는 모집글입니다.' }, { status: 404 })
  }

  if (pot.hostId !== me.id) {
    return NextResponse.json({ code: 'NOT_HOST', error: '방장만 수락/거절을 처리할 수 있습니다.' }, { status: 403 })
  }

  // 2. 대상 신청 상태 확인
  const [target] = await db
    .select({
      id: participations.id,
      approvalStatus: participations.approvalStatus,
      nickname: users.nickname,
    })
    .from(participations)
    .innerJoin(users, eq(participations.userId, users.id))
    .where(and(eq(participations.potId, potId), eq(participations.userId, targetUserId)))
    .limit(1)

  if (!target) {
    return NextResponse.json({ code: 'REQUEST_NOT_FOUND', error: '참여 신청 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (target.approvalStatus !== 'PENDING') {
    return NextResponse.json({ code: 'NOT_PENDING', error: '대기 중인 신청 건만 처리할 수 있습니다.' }, { status: 409 })
  }

  if (action === 'approve') {
    // 3. 승인 직전에 정원 다시 검사 (동시 승인 방어)
    const [{ cnt: approvedCnt }] = await db
      .select({ cnt: count() })
      .from(participations)
      .where(and(eq(participations.potId, potId), eq(participations.approvalStatus, 'APPROVED')))

    if (approvedCnt >= pot.targetValue) {
      return NextResponse.json({ code: 'POT_FULL', error: '인원이 이미 다 찼습니다.' }, { status: 409 })
    }

    const [updated] = await db
      .update(participations)
      .set({
        approvalStatus: 'APPROVED',
      })
      .where(eq(participations.id, target.id))
      .returning()

    // 승인 메시지 (채팅방)
    const [room] = await db
      .select({ id: chatRooms.id })
      .from(chatRooms)
      .where(eq(chatRooms.potId, potId))
      .limit(1)

    if (room) {
      await db.insert(messages).values({
        roomId: room.id,
        senderId: null,
        type: 'SYSTEM',
        content: `${target.nickname}님이 참여했습니다.`,
      })
    }

    // 🔔 알림 훅 B — 신청자에게 승인
    await createNotification(db, {
      recipientId: targetUserId,
      type: 'APPLICATION_APPROVED',
      potId,
      participationId: target.id,
      title: '참여가 승인되었어요',
      body: `${pot.storeName} 공동주문의 주문 채팅방을 확인해주세요.`,
      actionPath: room ? `/chat/${room.id}` : `/chat`,
      dedupeKey: `APPLICATION_APPROVED:${target.id}:${targetUserId}`,
    })

    return NextResponse.json({
      participation: {
        id: updated.id,
        potId: updated.potId,
        userId: updated.userId,
        approvalStatus: updated.approvalStatus,
        createdAt: updated.createdAt.toISOString(),
      },
    })
  } else {
    const [updated] = await db
      .update(participations)
      .set({
        approvalStatus: 'REJECTED',
      })
      .where(eq(participations.id, target.id))
      .returning()

    // 🔔 알림 훅 E — 신청자에게 거절
    await createNotification(db, {
      recipientId: targetUserId,
      type: 'APPLICATION_REJECTED',
      potId,
      participationId: target.id,
      title: '참여 신청이 승인되지 않았어요',
      body: `${pot.storeName} 공동주문의 참여 상태를 확인해주세요.`,
      actionPath: `/pots/${potId}`,
      dedupeKey: `APPLICATION_REJECTED:${target.id}:${targetUserId}`,
    })

    return NextResponse.json({
      participation: {
        id: updated.id,
        potId: updated.potId,
        userId: updated.userId,
        approvalStatus: updated.approvalStatus,
        createdAt: updated.createdAt.toISOString(),
      },
    })
  }
}
