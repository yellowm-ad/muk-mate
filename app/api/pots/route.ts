import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { chatRooms, participations, pots, users } from '@/lib/db/schema'
import { getPotById, getSessionUserOrNull, listPots } from '@/lib/server-data'

const STORE_NAME_MAX = 60
const ORDER_SUMMARY_MAX = 500
const PICKUP_NAME_MAX = 60
const NOTE_MAX = 300
const MIN_DEADLINE_MINUTES = 1
const MAX_DEADLINE_MINUTES = 24 * 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const zone = searchParams.get('zone') ?? undefined
  const status = searchParams.get('status') ?? undefined

  const result = await listPots({ zone, status })
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // v2.3: 정지/비활성 계정은 모집글 작성 불가 (17-4) — 세션(JWT)이 아니라 매 요청 DB 재조회로 즉시 반영
  const [meRow] = await getDb().select({ accountStatus: users.accountStatus }).from(users).where(eq(users.id, me.id)).limit(1)
  if (meRow?.accountStatus && meRow.accountStatus !== 'ACTIVE') {
    return NextResponse.json(
      { error: '계정이 일시 정지되거나 비활성화되어 모집글을 작성할 수 없습니다.' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  const storeName = typeof body.storeName === 'string' ? body.storeName.trim() : ''
  const storeAddress = typeof body.storeAddress === 'string' ? body.storeAddress.trim() : ''
  const storeLat = Number.isFinite(Number(body.storeLat)) ? Number(body.storeLat) : null
  const storeLng = Number.isFinite(Number(body.storeLng)) ? Number(body.storeLng) : null
  const orderSummary = typeof body.orderSummary === 'string' ? body.orderSummary.trim() : ''
  const zoneCode = typeof body.zoneCode === 'string' ? body.zoneCode : ''
  const targetType = body.targetType === 'AMOUNT' ? 'AMOUNT' : body.targetType === 'HEADCOUNT' ? 'HEADCOUNT' : null
  const targetValue = Number(body.targetValue)
  const deliveryFee = Number.isFinite(Number(body.deliveryFee)) ? Number(body.deliveryFee) : 0
  const deadlineMinutes = Number(body.deadlineMinutes)
  const pickupMinutes = Number(body.pickupMinutes)
  const pickupName = typeof body.pickupName === 'string' ? body.pickupName.trim() : ''
  const pickupAddress = typeof body.pickupAddress === 'string' ? body.pickupAddress.trim() : ''
  const pickupLat = Number.isFinite(Number(body.pickupLat)) ? Number(body.pickupLat) : null
  const pickupLng = Number.isFinite(Number(body.pickupLng)) ? Number(body.pickupLng) : null
  const pickupNote = typeof body.pickupNote === 'string' ? body.pickupNote.trim() : ''
  const extraNote = typeof body.extraNote === 'string' ? body.extraNote.trim() : ''

  if (!storeName || storeName.length > STORE_NAME_MAX) {
    return NextResponse.json({ error: '가게 이름을 확인해 주세요.' }, { status: 400 })
  }
  if (!orderSummary || orderSummary.length > ORDER_SUMMARY_MAX) {
    return NextResponse.json({ error: '주문 요약을 확인해 주세요.' }, { status: 400 })
  }
  if (!zoneCode) {
    return NextResponse.json({ error: '활동 권역을 선택해 주세요.' }, { status: 400 })
  }
  if (!targetType) {
    return NextResponse.json({ error: '모집 방식을 선택해 주세요.' }, { status: 400 })
  }
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return NextResponse.json({ error: '모집 목표 값을 확인해 주세요.' }, { status: 400 })
  }
  if (deliveryFee < 0) {
    return NextResponse.json({ error: '배달비를 확인해 주세요.' }, { status: 400 })
  }
  if (
    !Number.isFinite(deadlineMinutes) ||
    deadlineMinutes < MIN_DEADLINE_MINUTES ||
    deadlineMinutes > MAX_DEADLINE_MINUTES
  ) {
    return NextResponse.json({ error: '모집 마감 시각을 확인해 주세요.' }, { status: 400 })
  }
  if (!Number.isFinite(pickupMinutes) || pickupMinutes < deadlineMinutes) {
    return NextResponse.json({ error: '수령 시각은 마감 시각 이후여야 합니다.' }, { status: 400 })
  }
  if (!pickupName || pickupName.length > PICKUP_NAME_MAX) {
    return NextResponse.json({ error: '수령 장소를 확인해 주세요.' }, { status: 400 })
  }
  if (pickupNote.length > NOTE_MAX || extraNote.length > NOTE_MAX) {
    return NextResponse.json({ error: '전달사항이 너무 깁니다.' }, { status: 400 })
  }

  const db = getDb()
  const now = Date.now()
  const deadlineAt = new Date(now + deadlineMinutes * 60_000)
  const pickupAt = new Date(now + pickupMinutes * 60_000)

  const [created] = await db
    .insert(pots)
    .values({
      hostId: me.id,
      zoneCode,
      storeName,
      storeAddress: storeAddress || null,
      storeLat: storeLat !== null ? String(storeLat) : null,
      storeLng: storeLng !== null ? String(storeLng) : null,
      orderSummary,
      targetType,
      targetValue: Math.round(targetValue),
      deliveryFee: Math.round(deliveryFee),
      deadlineAt,
      pickupAt,
      pickupName,
      pickupAddress: pickupAddress || null,
      pickupLat: pickupLat !== null ? String(pickupLat) : null,
      pickupLng: pickupLng !== null ? String(pickupLng) : null,
      pickupNote: pickupNote || null,
      extraNote: extraNote || null,
    })
    .returning({ id: pots.id })

  // 설계 메모(§11-2): 호스트도 APPROVED 참여자로 등록해 두면 인원수 계산과
  // 채팅 권한 검사가 별도 분기 없이 단순해진다.
  await db.insert(participations).values({
    potId: created.id,
    userId: me.id,
    approvalStatus: 'APPROVED',
  })

  // 주문 채팅방은 모집글과 함께 바로 생성한다 — 호스트가 즉시 승인 상태이므로
  // 채팅방을 쓸 수 있어야 하고, chat_rooms.pot_id가 UNIQUE라 나중에 지연 생성하면
  // 동시성 문제(둘 이상이 동시에 처음 만들려는 경쟁)가 생길 수 있다.
  await db.insert(chatRooms).values({
    type: 'ORDER',
    potId: created.id,
    title: storeName,
  })

  const pot = await getPotById(created.id)

  return NextResponse.json({ pot }, { status: 201 })
}
