import { and, count, eq, inArray, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { chatRooms, mannerEvents, mannerReviews, messages, participations, pots } from '@/lib/db/schema'
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

const STORE_NAME_MAX = 60
const ORDER_SUMMARY_MAX = 500
const PICKUP_NAME_MAX = 60
const NOTE_MAX = 300

// 수정 화면(ORDER-08)에서는 가게·수령 장소·활동 권역·모집 방식(HEADCOUNT/AMOUNT)은 바꿀 수 없다 —
// 참여자가 이미 그 장소·방식을 보고 신청했고, 방식을 바꾸면 기존 menu_amount 입력과 어긋난다.
// 마감·수령 시각은 작성 폼의 "N분 후" 프리셋 대신 절대 시각(datetime-local)을 그대로 받는다.
async function handleEditPot(
  request: Request,
  id: string,
  me: { id: string },
): Promise<NextResponse> {
  const db = getDb()
  const [row] = await db
    .select({
      hostId: pots.hostId,
      status: pots.status,
      deadlineAt: pots.deadlineAt,
      targetType: pots.targetType,
    })
    .from(pots)
    .where(eq(pots.id, id))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: '존재하지 않는 공동주문입니다.' }, { status: 404 })
  }
  if (row.hostId !== me.id) {
    return NextResponse.json({ error: '모집자만 모집글을 수정할 수 있습니다.' }, { status: 403 })
  }

  const effectiveStatus = computeEffectiveStatus(row.status, row.deadlineAt)
  if (effectiveStatus !== 'OPEN') {
    return NextResponse.json(
      { error: '모집 중(OPEN) 상태인 모집글만 수정할 수 있습니다.' },
      { status: 409 },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  const orderSummary = typeof body.orderSummary === 'string' ? body.orderSummary.trim() : ''
  const targetValue = Number(body.targetValue)
  const deliveryFee = Number.isFinite(Number(body.deliveryFee)) ? Number(body.deliveryFee) : 0
  const deadlineAt = typeof body.deadlineAt === 'string' ? new Date(body.deadlineAt) : null
  const pickupAt = typeof body.pickupAt === 'string' && body.pickupAt ? new Date(body.pickupAt) : null
  const pickupNote = typeof body.pickupNote === 'string' ? body.pickupNote.trim() : ''
  const extraNote = typeof body.extraNote === 'string' ? body.extraNote.trim() : ''

  if (!orderSummary || orderSummary.length > ORDER_SUMMARY_MAX) {
    return NextResponse.json({ error: '주문 요약을 확인해 주세요.' }, { status: 400 })
  }
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return NextResponse.json({ error: '모집 목표 값을 확인해 주세요.' }, { status: 400 })
  }
  if (deliveryFee < 0) {
    return NextResponse.json({ error: '배달비를 확인해 주세요.' }, { status: 400 })
  }
  if (!deadlineAt || Number.isNaN(deadlineAt.getTime()) || deadlineAt.getTime() < Date.now()) {
    return NextResponse.json({ error: '모집 마감 시각을 확인해 주세요.' }, { status: 400 })
  }
  if (pickupAt && (Number.isNaN(pickupAt.getTime()) || pickupAt.getTime() < deadlineAt.getTime())) {
    return NextResponse.json({ error: '수령 시각은 마감 시각 이후여야 합니다.' }, { status: 400 })
  }
  if (pickupNote.length > NOTE_MAX || extraNote.length > NOTE_MAX) {
    return NextResponse.json({ error: '전달사항이 너무 깁니다.' }, { status: 400 })
  }

  if (row.targetType === 'HEADCOUNT') {
    // 방장 본인도 APPROVED 참여자 행을 갖고 있으므로 집계에서 제외한다 (§11-2 설계 메모).
    const [{ cnt: approvedCnt }] = await db
      .select({ cnt: count() })
      .from(participations)
      .where(
        and(
          eq(participations.potId, id),
          eq(participations.approvalStatus, 'APPROVED'),
          ne(participations.userId, me.id),
        ),
      )
    if (targetValue < approvedCnt + 1) {
      return NextResponse.json(
        { error: `이미 승인된 참여자(${approvedCnt + 1}명)보다 목표 인원을 적게 설정할 수 없습니다.` },
        { status: 409 },
      )
    }
  }

  await db
    .update(pots)
    .set({
      orderSummary,
      targetValue,
      deliveryFee,
      deadlineAt,
      pickupAt,
      pickupNote: pickupNote || null,
      extraNote: extraNote || null,
    })
    .where(eq(pots.id, id))

  const pot = await getPotById(id)
  return NextResponse.json({ pot })
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

  // 본문을 두 번 읽을 수 없으므로 클론해서 상태변경/필드수정 두 경로를 미리 갈라둔다.
  const rawBody = await request.clone().json().catch(() => null)
  if (!rawBody || typeof rawBody.status !== 'string') {
    return handleEditPot(request, id, me)
  }

  const body = rawBody
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

  await db
    .update(pots)
    .set({ status: nextStatus, ...(nextStatus === 'ORDERED' ? { orderedAt: new Date() } : {}) })
    .where(eq(pots.id, id))

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

  const [row] = await db.select({ hostId: pots.hostId, status: pots.status }).from(pots).where(eq(pots.id, id)).limit(1)
  if (!row) {
    return NextResponse.json({ code: 'POT_NOT_FOUND', error: '존재하지 않는 모집글입니다.' }, { status: 404 })
  }
  if (row.hostId !== me.id) {
    return NextResponse.json({ code: 'FORBIDDEN', error: '모집자만 삭제할 수 있습니다.' }, { status: 403 })
  }

  // 참여 신청(대기중 포함) 1건이라도 있으면 삭제 불가 — 단, 전원 거래 완료 확인을 거쳐 ORDERED가 된
  // 경우는 예외(먹튀 방지 조치, confirmPotCompletion 참고). 방장 본인도 모집글 생성 시 APPROVED
  // 참여자로 함께 등록되므로(POST /api/pots) 집계에서 제외한다.
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(participations)
    .where(and(eq(participations.potId, id), ne(participations.userId, me.id)))
  if (cnt > 0 && row.status !== 'ORDERED') {
    return NextResponse.json(
      { code: 'HAS_PARTICIPANTS', error: '참여자가 있는 모집글은 전원이 거래 완료를 확인해야 삭제할 수 있습니다.' },
      { status: 409 },
    )
  }

  // manner_reviews.pot_id → pots는 cascade지만 manner_events.review_id → manner_reviews는
  // cascade가 아니라서(§10 평가는 감점 이력이라 기본 보존), 리뷰가 있으면 이벤트부터 지워야
  // FK 위반 없이 pots를 삭제할 수 있다. 이미 manner_profiles에 반영된 점수 자체는 남는다 —
  // 지우는 건 이 모집글에 달린 이벤트 로그 행뿐이다.
  const reviews = await db.select({ id: mannerReviews.id }).from(mannerReviews).where(eq(mannerReviews.potId, id))
  if (reviews.length > 0) {
    await db.delete(mannerEvents).where(inArray(mannerEvents.reviewId, reviews.map((r) => r.id)))
  }

  await db.delete(pots).where(eq(pots.id, id))

  return NextResponse.json({ ok: true })
}
