import { and, count, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { participations, pots, users } from '@/lib/db/schema'
import { createNotification } from '@/lib/notifications'
import { computeEffectiveStatus, getSessionUserOrNull } from '@/lib/server-data'

const APPLY_MESSAGE_MAX = 200

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // v2.3: 정지/비활성 계정은 참여 신청 불가 (17-4) — 세션(JWT)이 아니라 매 요청 DB 재조회로 즉시 반영
  const [meRow] = await getDb().select({ accountStatus: users.accountStatus }).from(users).where(eq(users.id, me.id)).limit(1)
  if (meRow?.accountStatus && meRow.accountStatus !== 'ACTIVE') {
    return NextResponse.json(
      { code: 'ACCOUNT_RESTRICTED', error: '계정이 일시 정지되거나 비활성화되어 참여 신청할 수 없습니다.' },
      { status: 403 },
    )
  }

  const { id: potId } = await params
  const body = await request.json().catch(() => ({}))
  const menuMemo = typeof body?.menuMemo === 'string'
    ? body.menuMemo.trim()
    : typeof body?.applyMessage === 'string'
    ? body.applyMessage.trim()
    : ''

  if (menuMemo.length > APPLY_MESSAGE_MAX) {
    return NextResponse.json({ code: 'INVALID_INPUT', error: '메모가 너무 깁니다.' }, { status: 400 })
  }

  const db = getDb()

  // 1. 모집글 정보 확인
  const [pot] = await db
    .select({
      id: pots.id,
      hostId: pots.hostId,
      status: pots.status,
      targetValue: pots.targetValue,
      deadlineAt: pots.deadlineAt,
      storeName: pots.storeName,
    })
    .from(pots)
    .where(eq(pots.id, potId))
    .limit(1)

  if (!pot) {
    return NextResponse.json({ code: 'POT_NOT_FOUND', error: '존재하지 않는 모집글입니다.' }, { status: 404 })
  }

  if (pot.hostId === me.id) {
    return NextResponse.json({ code: 'HOST_CANNOT_JOIN', error: '방장은 참여 신청을 할 수 없습니다.' }, { status: 400 })
  }

  const effectiveStatus = computeEffectiveStatus(pot.status, pot.deadlineAt)
  if (effectiveStatus !== 'OPEN') {
    return NextResponse.json({ code: 'POT_NOT_RECRUITING', error: '모집 중인 상태가 아닙니다.' }, { status: 409 })
  }

  if (pot.deadlineAt.getTime() < Date.now()) {
    return NextResponse.json({ code: 'POT_EXPIRED', error: '마감 시간이 지났습니다.' }, { status: 409 })
  }

  // 2. 정원 초과 검사 (APPROVED 상태인 인원만 포함)
  const [{ cnt: approvedCnt }] = await db
    .select({ cnt: count() })
    .from(participations)
    .where(and(eq(participations.potId, potId), eq(participations.approvalStatus, 'APPROVED')))

  if (approvedCnt >= pot.targetValue) {
    return NextResponse.json({ code: 'POT_FULL', error: '인원이 다 찼습니다.' }, { status: 409 })
  }

  // 3. 기존 신청 상태 검사
  const [existing] = await db
    .select({ approvalStatus: participations.approvalStatus })
    .from(participations)
    .where(and(eq(participations.potId, potId), eq(participations.userId, me.id)))
    .limit(1)

  if (existing?.approvalStatus === 'PENDING') {
    return NextResponse.json({ code: 'ALREADY_REQUESTED', error: '이미 승인 대기 중인 신청이 있습니다.' }, { status: 409 })
  }
  if (existing?.approvalStatus === 'APPROVED') {
    return NextResponse.json({ code: 'ALREADY_MEMBER', error: '이미 참여 중인 멤버입니다.' }, { status: 409 })
  }
  if (existing?.approvalStatus === 'REJECTED') {
    return NextResponse.json({ code: 'REQUEST_REJECTED', error: '거절된 신청입니다.' }, { status: 403 })
  }

  // 4. 스팸 방지: PENDING 신청 건수가 정원의 3배를 넘으면 수락 거부
  const [{ cnt: pendingCnt }] = await db
    .select({ cnt: count() })
    .from(participations)
    .where(and(eq(participations.potId, potId), eq(participations.approvalStatus, 'PENDING')))

  if (pendingCnt >= pot.targetValue * 3) {
    return NextResponse.json({ code: 'TOO_MANY_PENDING', error: '대기 중인 신청이 너무 많아 더 이상 받지 않습니다.' }, { status: 429 })
  }

  // 5. PENDING 등록 (ON CONFLICT 구문 처리)
  const [inserted] = await db
    .insert(participations)
    .values({
      potId,
      userId: me.id,
      applyMessage: menuMemo || null,
      approvalStatus: 'PENDING',
    })
    .onConflictDoUpdate({
      target: [participations.potId, participations.userId],
      set: {
        approvalStatus: 'PENDING',
        applyMessage: menuMemo || null,
        createdAt: new Date(),
      },
    })
    .returning()

  // 🔔 알림 훅 A — 신청자 및 방장에게 알림 생성
  await createNotification(db, {
    recipientId: me.id,
    type: 'APPLICATION_SUBMITTED',
    potId,
    participationId: inserted.id,
    title: '참여 신청이 완료되었어요',
    body: `${pot.storeName} 공동주문의 모집자 승인을 기다려주세요.`,
    actionPath: `/pots/${potId}`,
    dedupeKey: `APPLICATION_SUBMITTED:${inserted.id}:${me.id}`,
  })

  await createNotification(db, {
    recipientId: pot.hostId,
    type: 'APPLICATION_RECEIVED',
    potId,
    participationId: inserted.id,
    title: '새 참여 신청이 들어왔어요',
    body: `${me.nickname}님이 ${pot.storeName} 공동주문에 신청했어요.`,
    actionPath: `/pots/${potId}`,
    dedupeKey: `APPLICATION_RECEIVED:${inserted.id}:${pot.hostId}`,
  })

  return NextResponse.json(
    {
      participation: {
        id: inserted.id,
        potId: inserted.potId,
        userId: inserted.userId,
        applyMessage: inserted.applyMessage ?? '',
        approvalStatus: inserted.approvalStatus,
        createdAt: inserted.createdAt.toISOString(),
      },
    },
    { status: 201 },
  )
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id: potId } = await params
  const db = getDb()

  const [pot] = await db
    .select({ id: pots.id, hostId: pots.hostId, status: pots.status, deadlineAt: pots.deadlineAt })
    .from(pots)
    .where(eq(pots.id, potId))
    .limit(1)

  if (!pot) {
    return NextResponse.json({ code: 'POT_NOT_FOUND', error: '존재하지 않는 모집글입니다.' }, { status: 404 })
  }

  if (pot.hostId === me.id) {
    return NextResponse.json({ code: 'HOST_CANNOT_LEAVE', error: '방장은 나갈 수 없습니다.' }, { status: 403 })
  }

  const effectiveStatus = computeEffectiveStatus(pot.status, pot.deadlineAt)
  if (effectiveStatus !== 'OPEN') {
    return NextResponse.json({ code: 'CANNOT_LEAVE_NOW', error: '마감된 후에는 취소하거나 나갈 수 없습니다.' }, { status: 409 })
  }

  const [existing] = await db
    .select({ id: participations.id, approvalStatus: participations.approvalStatus })
    .from(participations)
    .where(and(eq(participations.potId, potId), eq(participations.userId, me.id)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ code: 'NOT_PARTICIPATING', error: '참여 내역이 없습니다.' }, { status: 404 })
  }

  // PENDING 또는 APPROVED 상태에서 행 삭제
  await db
    .delete(participations)
    .where(eq(participations.id, existing.id))

  if (existing.approvalStatus === 'APPROVED') {
    // 🔔 알림 훅 D — 방장에게 나감 알림 (FEAT-05에서 연결)
  }

  return NextResponse.json({ ok: true })
}
