import 'server-only'

import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { REMEMBER_GUARD_COOKIE } from '@/lib/auth-constants'
import { getDb, getPgErrorCode } from '@/lib/db'
import {
  chatRooms,
  friendRequests,
  mannerEvents,
  mannerProfiles,
  mannerReviews,
  messageHides,
  messages,
  notifications,
  participations,
  pots,
  roomReads,
  userBlocks,
  userPreferences,
  users,
} from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { createNotification, createNotificationBulk } from '@/lib/notifications'
import { resolveViewerState } from '@/lib/pots/viewer-state'
import type {
  AppNotification,
  ChatRoom,
  FriendRequestSummary,
  FriendshipStatus,
  FriendSummary,
  MannerAvatarAccessory,
  MannerAvatarColor,
  MannerAvatarInfo,
  MannerProfile,
  MannerRating,
  MannerReviewStatus,
  MannerReviewTarget,
  MannerStage,
  Message,
  Participation,
  Pot,
  PotCompletionStatus,
  PotStatus,
  RoomAccess,
  RoomReadEntry,
  User,
  ZoneCode,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────
// 서버 컴포넌트 전용 데이터 접근 계층.
// 클라이언트 컴포넌트에서 이 파일을 import하면 안 된다 (위 'server-only' import가
// 실수로 그렇게 했을 때 빌드 타임에 바로 에러를 내준다). 브라우저에서 호출해야 하는
// 뮤테이션/조회는 lib/api.ts의 fetch() 기반 함수를 쓴다.
//
// 여기 있는 조회 로직은 app/api/pots*/route.ts의 GET 핸들러와 동일한 쿼리를
// 공유한다 — 페이지(서버 컴포넌트)가 직접 부르든, 외부에서 API로 부르든 같은 결과가
// 나오도록 하기 위함. Route Handler에서 인증/응답 포맷팅만 얹어서 재사용한다.
// ─────────────────────────────────────────────────────────────

export function computeEffectiveStatus(status: PotStatus, deadlineAt: Date): PotStatus {
  if (status === 'OPEN' && deadlineAt.getTime() < Date.now()) return 'CLOSED'
  return status
}

const potColumns = {
  id: pots.id,
  hostId: pots.hostId,
  hostNickname: users.nickname,
  zoneCode: pots.zoneCode,
  storeName: pots.storeName,
  storeAddress: pots.storeAddress,
  storeLat: pots.storeLat,
  storeLng: pots.storeLng,
  orderSummary: pots.orderSummary,
  targetType: pots.targetType,
  targetValue: pots.targetValue,
  deliveryFee: pots.deliveryFee,
  deadlineAt: pots.deadlineAt,
  pickupAt: pots.pickupAt,
  pickupName: pots.pickupName,
  pickupAddress: pots.pickupAddress,
  pickupLat: pots.pickupLat,
  pickupLng: pots.pickupLng,
  pickupNote: pots.pickupNote,
  extraNote: pots.extraNote,
  status: pots.status,
  createdAt: pots.createdAt,
} as const

type PotRow = {
  id: string
  hostId: string
  hostNickname: string
  zoneCode: string
  storeName: string
  storeAddress: string | null
  storeLat: string | null
  storeLng: string | null
  orderSummary: string
  targetType: 'HEADCOUNT' | 'AMOUNT'
  targetValue: number
  deliveryFee: number | null
  deadlineAt: Date
  pickupAt: Date | null
  pickupName: string
  pickupAddress: string | null
  pickupLat: string | null
  pickupLng: string | null
  pickupNote: string | null
  extraNote: string | null
  status: PotStatus
  createdAt: Date
}

function mapPotRow(row: PotRow, agg: { count: number; amount: number }): Pot {
  return {
    id: row.id,
    hostId: row.hostId,
    hostNickname: row.hostNickname,
    zoneCode: row.zoneCode as ZoneCode,
    storeName: row.storeName,
    storeAddress: row.storeAddress ?? '',
    storeLat: row.storeLat ? Number(row.storeLat) : undefined,
    storeLng: row.storeLng ? Number(row.storeLng) : undefined,
    orderSummary: row.orderSummary,
    targetType: row.targetType,
    targetValue: row.targetValue,
    currentCount: agg.count,
    currentAmount: row.targetType === 'AMOUNT' ? agg.amount : undefined,
    deliveryFee: row.deliveryFee ?? 0,
    deadlineAt: row.deadlineAt.toISOString(),
    pickupAt: row.pickupAt ? row.pickupAt.toISOString() : '',
    pickupName: row.pickupName,
    pickupAddress: row.pickupAddress ?? '',
    pickupLat: row.pickupLat ? Number(row.pickupLat) : undefined,
    pickupLng: row.pickupLng ? Number(row.pickupLng) : undefined,
    pickupNote: row.pickupNote ?? '',
    extraNote: row.extraNote ?? '',
    // §10-3③: 크론 없이 조회 시점에 마감 여부를 판정한다.
    status: computeEffectiveStatus(row.status, row.deadlineAt),
    // 카카오 로컬 API 검색 결과로 좌표까지 채워진 경우에만 "위치확인" — Phase 3 전까지는 항상 false
    isLocationVerified: Boolean(row.storeLat && row.storeLng),
    // ORDER-10(P1): 거리는 서버가 계산하지 않는다 — 클라이언트가 Geolocation 허용 시에만 채운다(§9-3)
    distanceMeters: null,
    createdAt: row.createdAt.toISOString(),
  }
}

async function getApprovedAggregates(potIds: string[]) {
  const byPot = new Map<string, { count: number; amount: number }>()
  if (potIds.length === 0) return byPot

  const rows = await getDb()
    .select({
      potId: participations.potId,
      approvalStatus: participations.approvalStatus,
      menuAmount: participations.menuAmount,
    })
    .from(participations)
    .where(inArray(participations.potId, potIds))

  for (const row of rows) {
    if (row.approvalStatus !== 'APPROVED') continue
    const entry = byPot.get(row.potId) ?? { count: 0, amount: 0 }
    entry.count += 1
    entry.amount += row.menuAmount ?? 0
    byPot.set(row.potId, entry)
  }
  return byPot
}

export async function listPots(filter?: { zone?: string; status?: string }): Promise<Pot[]> {
  const db = getDb()

  const rows = (await db
    .select(potColumns)
    .from(pots)
    .innerJoin(users, eq(pots.hostId, users.id))
    .where(filter?.zone ? eq(pots.zoneCode, filter.zone) : undefined)
    .orderBy(desc(pots.createdAt))) as PotRow[]

  const agg = await getApprovedAggregates(rows.map((r) => r.id))
  let result = rows.map((r) => mapPotRow(r, agg.get(r.id) ?? { count: 0, amount: 0 }))

  if (filter?.status && filter.status !== 'ALL') {
    result = result.filter((p) => p.status === filter.status)
  }
  return result
}

export async function getPotById(id: string, viewerId?: string | null): Promise<Pot | undefined> {
  const db = getDb()

  const [row] = (await db
    .select(potColumns)
    .from(pots)
    .innerJoin(users, eq(pots.hostId, users.id))
    .where(eq(pots.id, id))
    .limit(1)) as PotRow[]

  if (!row) return undefined

  const agg = await getApprovedAggregates([id])
  const pot = mapPotRow(row, agg.get(id) ?? { count: 0, amount: 0 })

  let myApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null = null
  if (viewerId) {
    const [myPart] = await db
      .select({ approvalStatus: participations.approvalStatus })
      .from(participations)
      .where(and(eq(participations.potId, id), eq(participations.userId, viewerId)))
      .limit(1)
    if (myPart) {
      myApprovalStatus = myPart.approvalStatus
    }
  }

  pot.approvedCount = pot.currentCount
  pot.viewerState = resolveViewerState({
    userId: viewerId,
    hostId: pot.hostId,
    potStatus: pot.status,
    myApprovalStatus,
    approvedCount: pot.currentCount,
    maxPeople: pot.targetValue,
  })

  return pot
}

/**
 * 모집글을 취소 처리 — 채팅방 시스템 메시지 + 활성 참여자(PENDING/APPROVED) 알림까지 함께 처리한다.
 * 방장이 직접 취소할 때(PATCH /api/pots/:id)와 회원 탈퇴로 자동 취소될 때 양쪽에서 재사용한다.
 */
export async function cancelPotAndNotify(potId: string, storeName: string, excludeUserId: string): Promise<void> {
  const db = getDb()

  await db.update(pots).set({ status: 'CANCELED' }).where(eq(pots.id, potId))

  const [room] = await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.potId, potId)).limit(1)
  if (room) {
    await db
      .insert(messages)
      .values({ roomId: room.id, senderId: null, type: 'SYSTEM', content: '공동주문이 취소되었습니다.' })
  }

  const activeMembers = await db
    .select({ userId: participations.userId })
    .from(participations)
    .where(and(eq(participations.potId, potId), inArray(participations.approvalStatus, ['PENDING', 'APPROVED'])))

  const recipients = activeMembers.map((m) => m.userId).filter((uid) => uid !== excludeUserId)
  await createNotificationBulk(
    db,
    recipients.map((uid) => ({
      recipientId: uid,
      type: 'POT_CANCELED',
      potId,
      title: '공동주문이 취소되었어요',
      body: `${storeName} 공동주문이 취소되었습니다.`,
      actionPath: `/pots/${potId}`,
      dedupeKey: `POT_CANCELED:${potId}:${uid}`,
    })),
  )
}

/** 마감된(CLOSED) 모집글의 "거래 완료" 확인 현황 — 모집글 상세 화면 배너용 조회 전용 함수 */
export async function getPotCompletionStatus(potId: string, viewerId: string): Promise<PotCompletionStatus> {
  const db = getDb()
  const rows = await db
    .select({ userId: participations.userId, completedAt: participations.completedAt })
    .from(participations)
    .where(and(eq(participations.potId, potId), eq(participations.approvalStatus, 'APPROVED')))

  const total = rows.length
  const done = rows.filter((r) => r.completedAt !== null).length
  const mine = rows.find((r) => r.userId === viewerId)

  return {
    total,
    done,
    allConfirmed: total > 0 && done === total,
    viewerConfirmed: mine?.completedAt != null,
    viewerIsMember: mine !== undefined,
  }
}

export type ConfirmPotCompletionResult =
  | { ok: true; allConfirmed: boolean; done: number; total: number }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_A_MEMBER' | 'NOT_CLOSED' | 'ALREADY_ORDERED' | 'CANCELED'; error: string }

/**
 * 거래 완료 확인(먹튀 방지 조치) — 모집 마감(CLOSED) 후 방장 포함 승인 참여자 전원이 각자
 * 이 함수를 호출해 확인해야 CLOSED→ORDERED로 자동 전이된다. 한 명이라도 확인하지 않으면
 * 절대 ORDERED가 되지 않고, DELETE /api/pots/:id도 ORDERED 상태에서만 삭제를 허용하므로
 * 방장이 일방적으로 방을 지워 참여 이력을 없애는 것도 막힌다.
 */
export async function confirmPotCompletion(potId: string, userId: string): Promise<ConfirmPotCompletionResult> {
  const db = getDb()

  const [pot] = await db
    .select({ status: pots.status, deadlineAt: pots.deadlineAt, storeName: pots.storeName })
    .from(pots)
    .where(eq(pots.id, potId))
    .limit(1)
  if (!pot) return { ok: false, code: 'NOT_FOUND', error: '존재하지 않는 공동주문입니다.' }

  if (pot.status === 'CANCELED') {
    return { ok: false, code: 'CANCELED', error: '취소된 공동주문은 거래 완료를 확인할 수 없습니다.' }
  }
  if (pot.status === 'ORDERED') {
    return { ok: false, code: 'ALREADY_ORDERED', error: '이미 완료 처리된 공동주문입니다.' }
  }
  if (computeEffectiveStatus(pot.status, pot.deadlineAt) !== 'CLOSED') {
    return { ok: false, code: 'NOT_CLOSED', error: '모집이 마감된 후에만 거래 완료를 확인할 수 있습니다.' }
  }

  const [myRow] = await db
    .select({ id: participations.id, completedAt: participations.completedAt })
    .from(participations)
    .where(
      and(
        eq(participations.potId, potId),
        eq(participations.userId, userId),
        eq(participations.approvalStatus, 'APPROVED'),
      ),
    )
    .limit(1)
  if (!myRow) {
    return { ok: false, code: 'NOT_A_MEMBER', error: '이 공동주문의 참여자만 거래 완료를 확인할 수 있습니다.' }
  }

  if (!myRow.completedAt) {
    await db.update(participations).set({ completedAt: new Date() }).where(eq(participations.id, myRow.id))
  }

  // 마감 시각이 지나 효과상 CLOSED이지만 실제 상태 컬럼이 아직 OPEN이면(§10-3③ 조회시점 판정과 동일하게
  // 지금까지 아무도 명시적으로 마감하지 않았던 경우) 여기서 같이 맞춰준다.
  if (pot.status === 'OPEN') {
    await db.update(pots).set({ status: 'CLOSED' }).where(eq(pots.id, potId))
  }

  const approvedRows = await db
    .select({ userId: participations.userId, completedAt: participations.completedAt })
    .from(participations)
    .where(and(eq(participations.potId, potId), eq(participations.approvalStatus, 'APPROVED')))

  const total = approvedRows.length
  const done = approvedRows.filter((r) => r.completedAt !== null).length
  const allConfirmed = total > 0 && done === total

  if (allConfirmed) {
    await db.update(pots).set({ status: 'ORDERED', orderedAt: new Date() }).where(eq(pots.id, potId))

    const [room] = await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.potId, potId)).limit(1)
    if (room) {
      await db.insert(messages).values({
        roomId: room.id,
        senderId: null,
        type: 'SYSTEM',
        content: '전원이 거래 완료를 확인해 공동주문이 완료되었습니다.',
      })
    }

    const recipients = approvedRows.map((r) => r.userId).filter((uid) => uid !== userId)
    await createNotificationBulk(
      db,
      recipients.map((uid) => ({
        recipientId: uid,
        type: 'POT_COMPLETED',
        potId,
        title: '공동주문이 완료되었어요',
        body: `${pot.storeName} 공동주문이 완료 처리되었어요.`,
        actionPath: `/pots/${potId}`,
        dedupeKey: `POT_COMPLETED:${potId}:${uid}`,
      })),
    )
  }

  return { ok: true, allConfirmed, done, total }
}

/**
 * 회원 탈퇴(소프트) — 완전 삭제하지 않는다. 다른 사용자가 보던 채팅 기록·참여 이력이
 * FK로 얽혀 있어 하드 삭제하면 그 사람들 화면이 깨지기 때문에, account_status를
 * DISABLED로 바꿔 로그인·참여·작성·채팅 전 경로를 막고(v2.3 확장분 재사용) 닉네임만
 * 익명화한다. 호스트로 있는 모집중(OPEN/CLOSED) 모집글은 자동 취소해 참여자들에게 알린다.
 */
export async function withdrawUser(userId: string): Promise<void> {
  const db = getDb()

  const hostedPots = await db
    .select({ id: pots.id, status: pots.status, deadlineAt: pots.deadlineAt, storeName: pots.storeName })
    .from(pots)
    .where(eq(pots.hostId, userId))

  for (const p of hostedPots) {
    const effective = computeEffectiveStatus(p.status, p.deadlineAt)
    if (effective === 'OPEN' || effective === 'CLOSED') {
      await cancelPotAndNotify(p.id, p.storeName, userId)
    }
  }

  await db.update(users).set({ accountStatus: 'DISABLED', nickname: '탈퇴한 사용자' }).where(eq(users.id, userId))
}

async function getPotsByIds(ids: string[]): Promise<Map<string, Pot>> {
  const map = new Map<string, Pot>()
  if (ids.length === 0) return map

  const rows = (await getDb()
    .select(potColumns)
    .from(pots)
    .innerJoin(users, eq(pots.hostId, users.id))
    .where(inArray(pots.id, ids))) as PotRow[]

  const agg = await getApprovedAggregates(rows.map((r) => r.id))
  for (const r of rows) map.set(r.id, mapPotRow(r, agg.get(r.id) ?? { count: 0, amount: 0 }))
  return map
}

/** 내가 만든 공동주문 (MY-02) */
export async function getMyHostedPots(userId: string): Promise<Pot[]> {
  const db = getDb()

  const rows = (await db
    .select(potColumns)
    .from(pots)
    .innerJoin(users, eq(pots.hostId, users.id))
    .where(eq(pots.hostId, userId))
    .orderBy(desc(pots.createdAt))) as PotRow[]

  if (rows.length === 0) return []

  const potIds = rows.map((r) => r.id)
  const aggPromise = getApprovedAggregates(potIds)

  const pendingPromise = db
    .select({ potId: participations.potId })
    .from(participations)
    .where(
      and(
        inArray(participations.potId, potIds),
        eq(participations.approvalStatus, 'PENDING'),
      ),
    )

  const roomPromise = db
    .select({ id: chatRooms.id, potId: chatRooms.potId })
    .from(chatRooms)
    .where(inArray(chatRooms.potId, potIds))

  const [agg, pendingRows, roomRows] = await Promise.all([
    aggPromise,
    pendingPromise,
    roomPromise,
  ])

  const pendingMap = new Map<string, number>()
  for (const p of pendingRows) {
    pendingMap.set(p.potId, (pendingMap.get(p.potId) ?? 0) + 1)
  }

  const roomMap = new Map<string, string>()
  for (const r of roomRows) {
    if (r.potId) roomMap.set(r.potId, r.id)
  }

  return rows.map((r) => {
    const pot = mapPotRow(r, agg.get(r.id) ?? { count: 0, amount: 0 })
    pot.pendingCount = pendingMap.get(r.id) ?? 0
    pot.chatRoomId = roomMap.get(r.id)
    return pot
  })
}

/**
 * 내가 참여 신청한 공동주문 (MY-02/03) — 내가 호스트인 글에 대한 자동 APPROVED 행은
 * "내가 만든 글"(getMyHostedPots)에서 이미 보여주므로 여기서는 제외한다.
 */
export async function getMyApplications(
  userId: string,
): Promise<{ participation: Participation; pot: Pot }[]> {
  const db = getDb()

  const rows = await db
    .select({
      id: participations.id,
      potId: participations.potId,
      applyMessage: participations.applyMessage,
      menuAmount: participations.menuAmount,
      approvalStatus: participations.approvalStatus,
      createdAt: participations.createdAt,
      hostId: pots.hostId,
      nickname: users.nickname,
    })
    .from(participations)
    .innerJoin(pots, eq(participations.potId, pots.id))
    .innerJoin(users, eq(participations.userId, users.id))
    .where(eq(participations.userId, userId))
    .orderBy(desc(participations.createdAt))

  const mine = rows.filter((r) => r.hostId !== userId)
  if (mine.length === 0) return []

  const potIds = [...new Set(mine.map((r) => r.potId))]
  const [potMap, roomRows] = await Promise.all([
    getPotsByIds(potIds),
    db.select({ id: chatRooms.id, potId: chatRooms.potId }).from(chatRooms).where(inArray(chatRooms.potId, potIds)),
  ])

  const roomMap = new Map<string, string>()
  for (const r of roomRows) {
    if (r.potId) roomMap.set(r.potId, r.id)
  }

  const result: { participation: Participation; pot: Pot }[] = []
  for (const r of mine) {
    const pot = potMap.get(r.potId)
    if (!pot) continue
    const potWithRoom = { ...pot, chatRoomId: roomMap.get(r.potId) }
    result.push({
      participation: {
        id: r.id,
        potId: r.potId,
        userId,
        nickname: r.nickname,
        applyMessage: r.applyMessage ?? '',
        menuAmount: r.menuAmount ?? 0,
        approvalStatus: r.approvalStatus,
        createdAt: r.createdAt.toISOString(),
      },
      pot: potWithRoom,
    })
  }
  return result
}

/** 호스트 본인의 참여 행에 담긴 주문 금액(§5-4 분담 계산용) — getParticipationsForPot는 호스트 행을 제외하므로 별도 조회 */
export async function getHostMenuAmount(potId: string, hostId: string): Promise<number> {
  const db = getDb()
  const [row] = await db
    .select({ menuAmount: participations.menuAmount })
    .from(participations)
    .where(and(eq(participations.potId, potId), eq(participations.userId, hostId)))
    .limit(1)
  return row?.menuAmount ?? 0
}

/**
 * 공동주문의 참여자 목록. 호스트 자신의 행은 화면에서 별도(주최자 배지)로 표시하므로 제외한다.
 * 호스트가 아닌 조회자에게는 APPROVED 신청만 보여준다 — PENDING/REJECTED의 참여 메시지 등은
 * 호스트만 볼 수 있는 정보라 여기서 서버가 걸러야 한다 (클라이언트에서 숨기는 것만으로는 불충분).
 */
export async function getParticipationsForPot(potId: string, viewerId: string | undefined): Promise<Participation[]> {
  const db = getDb()

  const [pot] = await db.select({ hostId: pots.hostId }).from(pots).where(eq(pots.id, potId)).limit(1)
  if (!pot) return []

  const isHost = viewerId === pot.hostId

  const rows = await db
    .select({
      id: participations.id,
      potId: participations.potId,
      userId: participations.userId,
      nickname: users.nickname,
      applyMessage: participations.applyMessage,
      menuAmount: participations.menuAmount,
      approvalStatus: participations.approvalStatus,
      createdAt: participations.createdAt,
    })
    .from(participations)
    .innerJoin(users, eq(participations.userId, users.id))
    .where(eq(participations.potId, potId))

  const visible = isHost ? rows : rows.filter((r) => r.approvalStatus === 'APPROVED')
  const others = visible.filter((r) => r.userId !== pot.hostId)
  const mannerMap = await getMannerAvatarsForUsers(others.map((r) => r.userId))

  return others.map((r) => ({
    id: r.id,
    potId: r.potId,
    userId: r.userId,
    nickname: r.nickname,
    applyMessage: r.applyMessage ?? '',
    menuAmount: r.menuAmount ?? 0,
    approvalStatus: r.approvalStatus,
    createdAt: r.createdAt.toISOString(),
    manner: mannerMap.get(r.userId),
  }))
}

export async function getPendingRequestsForPot(potId: string): Promise<{
  userId: string
  nickname: string
  menuMemo: string
  requestedAt: string
  manner?: MannerAvatarInfo
}[]> {
  const db = getDb()

  const rows = await db
    .select({
      userId: participations.userId,
      nickname: users.nickname,
      applyMessage: participations.applyMessage,
      requestedAt: participations.createdAt,
    })
    .from(participations)
    .innerJoin(users, eq(participations.userId, users.id))
    .where(
      and(
        eq(participations.potId, potId),
        eq(participations.approvalStatus, 'PENDING'),
      ),
    )
    .orderBy(desc(participations.createdAt))

  const mannerMap = await getMannerAvatarsForUsers(rows.map((r) => r.userId))

  return rows.map((r) => ({
    userId: r.userId,
    nickname: r.nickname,
    menuMemo: r.applyMessage ?? '',
    requestedAt: r.requestedAt.toISOString(),
    manner: mannerMap.get(r.userId),
  }))
}

/** 로그인된 사용자 정보. 세션이 없으면 로그인 화면으로 보낸다 — (main) 구간은 전부 로그인 전제. */
/**
 * "로그인 상태 유지" 미체크 시 브라우저 종료로 사라지는 가드 쿠키가 있는지 확인한다.
 * NextAuth 세션 쿠키 자체는 항상 30일 고정이라, 이 보조 쿠키가 없으면 로그아웃 상태로 취급한다
 * (lib/auth-constants.ts 참고).
 */
async function hasRememberGuard(): Promise<boolean> {
  const store = await cookies()
  return store.get(REMEMBER_GUARD_COOKIE) !== undefined
}

export async function getCurrentUser(): Promise<User> {
  const session = await auth()
  if (!session?.user || !(await hasRememberGuard())) {
    redirect('/login')
  }
  return {
    id: session.user.id,
    loginId: session.user.loginId,
    nickname: session.user.nickname,
    zoneCode: session.user.zoneCode as ZoneCode,
    role: session.user.role as User['role'],
  }
}

/** API Route Handler에서 쓰는 버전 — 리다이렉트 대신 null을 돌려주고 401 처리는 호출부가 한다. */
export async function getSessionUserOrNull(): Promise<User | null> {
  const session = await auth()
  if (!session?.user || !(await hasRememberGuard())) return null
  return {
    id: session.user.id,
    loginId: session.user.loginId,
    nickname: session.user.nickname,
    zoneCode: session.user.zoneCode as ZoneCode,
    role: session.user.role as User['role'],
  }
}

/**
 * 전북대 이메일 연동 상태(본인 확인용, 마이페이지 기본정보 수정 화면 전용).
 * 세션/JWT나 공용 User 타입에는 절대 싣지 않고 이렇게 별도 조회로 격리한다 —
 * 다른 화면·다른 사용자에게 새어나가는 경로를 원천적으로 없애기 위함.
 */
export async function getMyJbnuEmailStatus(userId: string): Promise<{ email: string; verifiedAt: string } | null> {
  const [row] = await getDb()
    .select({ jbnuEmail: users.jbnuEmail, jbnuEmailVerifiedAt: users.jbnuEmailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row?.jbnuEmail || !row.jbnuEmailVerifiedAt) return null
  return { email: row.jbnuEmail, verifiedAt: row.jbnuEmailVerifiedAt.toISOString() }
}

/** 마이페이지 > 환경설정 화면들의 초기값 — 행이 없으면 기본값(전부 켜짐, 자동수락은 꺼짐)으로 취급. */
export async function getMyPreferences(userId: string): Promise<{
  potNotificationsEnabled: boolean
  friendNotificationsEnabled: boolean
  autoAcceptFriendRequests: boolean
}> {
  const [row] = await getDb().select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
  return {
    potNotificationsEnabled: row?.potNotificationsEnabled ?? true,
    friendNotificationsEnabled: row?.friendNotificationsEnabled ?? true,
    autoAcceptFriendRequests: row?.autoAcceptFriendRequests ?? false,
  }
}

// ─────────────────────────────────────────────────────────────
// 채팅 (PRD §5-2, §10-3①). 폴링 전용 — WebSocket/SSE 안 씀.
// 자세한 규칙: .claude/skills/mukmate-chat-polling/SKILL.md
// ─────────────────────────────────────────────────────────────

async function getLastMessagesForRooms(roomIds: string[]) {
  const db = getDb()
  const result = new Map<string, { content: string; createdAt: Date }>()
  for (const roomId of roomIds) {
    const [last] = await db
      .select({ content: messages.content, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.id))
      .limit(1)
    if (last) result.set(roomId, last)
  }
  return result
}

/** 읽음 표시(v2.5): 채팅 목록에서 방마다 보여줄 "내가 안 읽은 메시지 수" — room_reads의 개인 커서 기준 */
async function getUnreadCountsForRooms(roomIds: string[], userId: string): Promise<Map<string, number>> {
  if (roomIds.length === 0) return new Map()
  const db = getDb()

  const rows = await db
    .select({
      roomId: messages.roomId,
      unreadCount: sql<number>`count(*) filter (where ${messages.id} > coalesce(${roomReads.lastReadMessageId}, 0))`,
    })
    .from(messages)
    .leftJoin(roomReads, and(eq(roomReads.roomId, messages.roomId), eq(roomReads.userId, userId)))
    .where(inArray(messages.roomId, roomIds))
    .groupBy(messages.roomId)

  return new Map(rows.map((r) => [r.roomId, Number(r.unreadCount)]))
}

/**
 * 로그인 사용자의 채팅방 목록 — 내가 host이거나 APPROVED 참여자인 ORDER 방
 * (호스트도 자동 APPROVED 행이 있으므로 별도 분기 불필요) + 전체 COMMUNITY 고정방.
 */
export async function listRoomsForUser(userId: string): Promise<ChatRoom[]> {
  const db = getDb()

  const orderRoomsRaw = await db
    .select({
      id: chatRooms.id,
      potId: chatRooms.potId,
      title: chatRooms.title,
      potStatus: pots.status,
      potDeadlineAt: pots.deadlineAt,
      pickupName: pots.pickupName,
      pickupAt: pots.pickupAt,
    })
    .from(chatRooms)
    .innerJoin(pots, eq(chatRooms.potId, pots.id))
    .innerJoin(
      participations,
      and(
        eq(participations.potId, pots.id),
        eq(participations.userId, userId),
        eq(participations.approvalStatus, 'APPROVED'),
      ),
    )
    .where(eq(chatRooms.type, 'ORDER'))
    .orderBy(desc(chatRooms.createdAt))

  const communityRoomsRaw = await db
    .select({ id: chatRooms.id, title: chatRooms.title, createdAt: chatRooms.createdAt })
    .from(chatRooms)
    .where(eq(chatRooms.type, 'COMMUNITY'))
    .orderBy(asc(chatRooms.createdAt))

  // 친구 DM(신규) — 상대방 닉네임을 방 제목으로 그때그때 덮어써서 보여준다(닉네임 변경에도 항상 최신값).
  const dmRoomsRaw = await db
    .select({ id: chatRooms.id, dmUserAId: chatRooms.dmUserAId, dmUserBId: chatRooms.dmUserBId })
    .from(chatRooms)
    .where(and(eq(chatRooms.type, 'DM'), or(eq(chatRooms.dmUserAId, userId), eq(chatRooms.dmUserBId, userId))))
    .orderBy(desc(chatRooms.createdAt))

  const otherUserIds = dmRoomsRaw
    .map((r) => (r.dmUserAId === userId ? r.dmUserBId : r.dmUserAId))
    .filter((id): id is string => Boolean(id))
  const otherUsers =
    otherUserIds.length > 0
      ? await db.select({ id: users.id, nickname: users.nickname }).from(users).where(inArray(users.id, otherUserIds))
      : []
  const otherUserNicknameMap = new Map(otherUsers.map((u) => [u.id, u.nickname]))

  const allRoomIds = [
    ...orderRoomsRaw.map((r) => r.id),
    ...communityRoomsRaw.map((r) => r.id),
    ...dmRoomsRaw.map((r) => r.id),
  ]
  const lastMessages = await getLastMessagesForRooms(allRoomIds)
  const unreadCounts = await getUnreadCountsForRooms(allRoomIds, userId)

  const orderRooms: ChatRoom[] = orderRoomsRaw.map((r) => {
    const last = lastMessages.get(r.id)
    return {
      id: r.id,
      type: 'ORDER',
      potId: r.potId,
      title: r.title,
      subtitle: r.pickupAt ? `${r.pickupName} · ${formatDateTime(r.pickupAt.toISOString())}` : r.pickupName,
      potStatus: computeEffectiveStatus(r.potStatus, r.potDeadlineAt),
      lastMessage: last?.content ?? '',
      lastMessageAt: last?.createdAt.toISOString() ?? '',
      unreadCount: unreadCounts.get(r.id) ?? 0,
    }
  })

  const communityRooms: ChatRoom[] = communityRoomsRaw.map((r) => {
    const last = lastMessages.get(r.id)
    return {
      id: r.id,
      type: 'COMMUNITY',
      potId: null,
      title: r.title,
      lastMessage: last?.content ?? '',
      lastMessageAt: last?.createdAt.toISOString() ?? '',
      unreadCount: unreadCounts.get(r.id) ?? 0,
    }
  })

  const dmRooms: ChatRoom[] = dmRoomsRaw.map((r) => {
    const otherUserId = r.dmUserAId === userId ? r.dmUserBId : r.dmUserAId
    const last = lastMessages.get(r.id)
    return {
      id: r.id,
      type: 'DM',
      potId: null,
      title: (otherUserId && otherUserNicknameMap.get(otherUserId)) || '알 수 없는 사용자',
      otherUserId: otherUserId ?? undefined,
      lastMessage: last?.content ?? '',
      lastMessageAt: last?.createdAt.toISOString() ?? '',
      unreadCount: unreadCounts.get(r.id) ?? 0,
    }
  })

  return [...orderRooms, ...dmRooms, ...communityRooms]
}

/**
 * 채팅방 접근 권한 검사 — null이면 접근 불가(404/403 처리는 호출부가 한다).
 * ORDER 방은 host+APPROVED 참여자만, COMMUNITY 방은 로그인 사용자 전체 (CHAT-01).
 * URL을 직접 입력해도 이 검사를 반드시 거치게 만드는 게 핵심 — 클라이언트 라우트
 * 가드만으로는 불충분하다.
 */
export async function getRoomForViewer(roomId: string, viewerId: string | undefined): Promise<RoomAccess | null> {
  if (!viewerId) return null

  const db = getDb()
  const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1)
  if (!room) return null

  if (room.type === 'COMMUNITY') {
    return { id: room.id, type: 'COMMUNITY', title: room.title }
  }

  if (room.type === 'DM') {
    if (room.dmUserAId !== viewerId && room.dmUserBId !== viewerId) return null
    const otherUserId = room.dmUserAId === viewerId ? room.dmUserBId : room.dmUserAId
    if (!otherUserId) return null

    const [other] = await db.select({ nickname: users.nickname }).from(users).where(eq(users.id, otherUserId)).limit(1)
    if (!other) return null

    const [isFriend, isBlockedByMe] = await Promise.all([
      areFriends(viewerId, otherUserId),
      isBlocked(viewerId, otherUserId),
    ])
    return {
      id: room.id,
      type: 'DM',
      title: other.nickname,
      dm: { otherUserId, otherNickname: other.nickname, isFriend, isBlockedByMe },
    }
  }

  if (!room.potId) return null
  const [pot] = await db.select().from(pots).where(eq(pots.id, room.potId)).limit(1)
  if (!pot) return null

  const [membership] = await db
    .select({ id: participations.id })
    .from(participations)
    .where(
      and(
        eq(participations.potId, pot.id),
        eq(participations.userId, viewerId),
        eq(participations.approvalStatus, 'APPROVED'),
      ),
    )
    .limit(1)

  if (!membership) return null

  return {
    id: room.id,
    type: 'ORDER',
    title: room.title,
    pot: {
      id: pot.id,
      storeName: pot.storeName,
      pickupName: pot.pickupName,
      pickupAt: pot.pickupAt ? pot.pickupAt.toISOString() : '',
      status: computeEffectiveStatus(pot.status, pot.deadlineAt),
    },
  }
}

/** `after` 커서(직전까지 받은 마지막 messages.id) 이후의 새 메시지만 증분 조회한다. */
export async function getMessagesForRoom(
  roomId: string,
  afterId: number,
  viewerId: string | undefined,
): Promise<Message[]> {
  const db = getDb()

  const rows = await db
    .select({
      id: messages.id,
      roomId: messages.roomId,
      senderId: messages.senderId,
      senderNickname: users.nickname,
      type: messages.type,
      content: messages.content,
      createdAt: messages.createdAt,
      deletedAt: messages.deletedAt,
      hideId: messageHides.id,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .leftJoin(
      messageHides,
      and(eq(messageHides.messageId, messages.id), eq(messageHides.userId, viewerId ?? '')),
    )
    .where(and(eq(messages.roomId, roomId), gt(messages.id, afterId), isNull(messageHides.id)))
    .orderBy(asc(messages.id))

  // v2.14: 메시지 발신자 옆에도 매너 아바타 노출 — SYSTEM 메시지(senderId 없음)는 대상에서 제외
  const senderIds = rows.map((r) => r.senderId).filter((id): id is string => Boolean(id))
  const mannerMap = await getMannerAvatarsForUsers(senderIds)

  return rows.map((r) => ({
    id: String(r.id),
    roomId: r.roomId,
    senderId: r.senderId ?? '',
    senderNickname: r.senderNickname ?? '',
    type: r.type,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    isMine: r.senderId === viewerId,
    manner: r.senderId ? mannerMap.get(r.senderId) : undefined,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  }))
}

// 채팅 삭제(카카오톡 스타일) — 보낸 사람이 이 시간 안에 지우면 전체 삭제, 지나면 본인 화면에서만 숨김.
const MESSAGE_DELETE_WINDOW_MS = 5 * 60 * 1000
// 이미 화면에 떠 있던 메시지가 전체 삭제됐을 때도 반영되도록, 폴링 때마다 최근 이 시간 내의
// 전체 삭제 id 목록을 함께 내려준다(§채팅 삭제 — 폴링 반영 설계).
const RECENT_DELETE_WINDOW_MS = 10 * 60 * 1000

/** 최근 전체 삭제된 메시지 id 목록 — 이미 불러온 메시지가 뒤늦게 삭제됐을 때 폴링으로 반영하기 위함 */
export async function getRecentlyDeletedMessageIds(roomId: string): Promise<number[]> {
  const db = getDb()
  const cutoff = new Date(Date.now() - RECENT_DELETE_WINDOW_MS)
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.roomId, roomId), gt(messages.deletedAt, cutoff)))
  return rows.map((r) => r.id)
}

export type DeleteMessagesResult =
  | { ok: true }
  | { ok: false; code: 'INVALID_INPUT'; error: string }

/**
 * 채팅 삭제 — 본인이 보낸 지 5분 이내인 메시지는 전체 삭제(모두에게 "메시지가 삭제되었습니다"),
 * 그 외(남의 메시지이거나 5분이 지난 내 메시지)는 나만 안 보이게 숨긴다. 어느 쪽이든 클라이언트가
 * 미리 알려준 값을 신뢰하지 않고 여기서 다시 판정한다.
 */
export async function deleteMessagesForViewer(
  roomId: string,
  viewerId: string,
  messageIds: number[],
): Promise<DeleteMessagesResult> {
  if (messageIds.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', error: '삭제할 메시지를 선택해주세요.' }
  }

  const db = getDb()
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      type: messages.type,
      createdAt: messages.createdAt,
      deletedAt: messages.deletedAt,
    })
    .from(messages)
    .where(and(eq(messages.roomId, roomId), inArray(messages.id, messageIds)))

  const now = Date.now()
  const realDeleteIds: number[] = []
  const hideIds: number[] = []

  for (const row of rows) {
    if (row.type !== 'TEXT' || row.deletedAt) continue // SYSTEM, 이미 전체 삭제된 메시지는 대상 아님
    const isOwn = row.senderId === viewerId
    const withinWindow = now - row.createdAt.getTime() < MESSAGE_DELETE_WINDOW_MS
    if (isOwn && withinWindow) {
      realDeleteIds.push(row.id)
    } else {
      hideIds.push(row.id)
    }
  }

  if (realDeleteIds.length === 0 && hideIds.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', error: '삭제할 수 있는 메시지가 없습니다.' }
  }

  if (realDeleteIds.length > 0) {
    await db.update(messages).set({ deletedAt: new Date() }).where(inArray(messages.id, realDeleteIds))
  }
  if (hideIds.length > 0) {
    await db
      .insert(messageHides)
      .values(hideIds.map((id) => ({ messageId: id, userId: viewerId })))
      .onConflictDoNothing()
  }

  return { ok: true }
}

/**
 * 읽음 표시(v2.5): 이번 방문 이전까지의 읽음 커서 — 화면 진입 시 "마지막으로 읽은 지점"으로
 * 스크롤을 복원하는 용도이므로, 반드시 markRoomRead()로 커서를 갱신하기 **전에** 호출해야 한다.
 * 커서 행이 아예 없으면(첫 방문) null — 이 경우 복원할 지점이 없으므로 호출부가 맨 아래로 보낸다.
 */
export async function getMyReadCursor(roomId: string, userId: string): Promise<number | null> {
  const db = getDb()
  const [row] = await db
    .select({ lastReadMessageId: roomReads.lastReadMessageId })
    .from(roomReads)
    .where(and(eq(roomReads.roomId, roomId), eq(roomReads.userId, userId)))
    .limit(1)
  return row ? row.lastReadMessageId : null
}

/** 읽음 표시(v2.5): viewer가 이 방을 보고 있다는 뜻이므로 현재까지의 마지막 메시지로 읽음 커서를 올린다. */
export async function markRoomRead(roomId: string, viewerId: string): Promise<void> {
  const db = getDb()

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${messages.id}), 0)` })
    .from(messages)
    .where(eq(messages.roomId, roomId))

  if (maxId <= 0) return

  await db
    .insert(roomReads)
    .values({ roomId, userId: viewerId, lastReadMessageId: maxId })
    .onConflictDoUpdate({
      target: [roomReads.roomId, roomReads.userId],
      set: {
        lastReadMessageId: sql`GREATEST(${roomReads.lastReadMessageId}, ${maxId})`,
        updatedAt: new Date(),
      },
    })
}

/** 읽음 표시(v2.5): ORDER 방 참여자(승인된 참여자 전원, 방장 포함) 각각의 읽음 커서 스냅샷 */
export async function getRoomReads(roomId: string, potId: string): Promise<RoomReadEntry[]> {
  const db = getDb()

  const participants = await db
    .select({ userId: participations.userId })
    .from(participations)
    .where(and(eq(participations.potId, potId), eq(participations.approvalStatus, 'APPROVED')))

  if (participants.length === 0) return []

  const participantIds = participants.map((p) => p.userId)
  const readRows = await db
    .select({ userId: roomReads.userId, lastReadMessageId: roomReads.lastReadMessageId })
    .from(roomReads)
    .where(and(eq(roomReads.roomId, roomId), inArray(roomReads.userId, participantIds)))

  const readMap = new Map(readRows.map((r) => [r.userId, r.lastReadMessageId]))

  return participantIds.map((userId) => ({
    userId,
    lastReadMessageId: readMap.get(userId) ?? 0,
  }))
}

export async function getNotificationsForUser(
  userId: string,
  cursorId?: number,
  limit = 20,
): Promise<{ items: AppNotification[]; nextCursor?: number }> {
  const db = getDb()

  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, userId),
        cursorId ? lt(notifications.id, cursorId) : undefined,
      ),
    )
    .orderBy(desc(notifications.id))
    .limit(limit + 1)

  const hasNext = rows.length > limit
  const itemsRaw = hasNext ? rows.slice(0, limit) : rows

  const items: AppNotification[] = itemsRaw.map((r) => ({
    id: r.id,
    recipientId: r.recipientId,
    type: r.type,
    potId: r.potId,
    participationId: r.participationId,
    title: r.title,
    body: r.body,
    actionPath: r.actionPath,
    isRead: r.isRead,
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }))

  const nextCursor = hasNext ? itemsRaw[itemsRaw.length - 1].id : undefined

  return { items, nextCursor }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const db = getDb()

  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)))

  return cnt
}

// ─────────────────────────────────────────────────────────────
// 매너 포만도(P0) — PRD 범위 밖 별도 기획안("매너 포만도 및 성장형 아바타")의 P0 슬라이스.
// 점수 계산·반영은 여기(서버)에서만 한다 — 클라이언트는 rating/tags만 보낸다.
// "48시간 경과 또는 양측 제출" 반영은 크론 없이, 해당 유저의 매너 데이터를 읽거나 쓸 때마다
// applyDueMannerReviews()로 그때그때 정산한다(§10-3③ 크론 금지 원칙과 동일 패턴).
// ─────────────────────────────────────────────────────────────

export const MANNER_RATING_DELTA: Record<MannerRating, number> = { GOOD: 1.5, NEUTRAL: 0, BAD: -3 }
const MANNER_REVIEW_REVEAL_MS = 48 * 60 * 60 * 1000
const MANNER_REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function computeMannerStage(score: number, reviewCount: number): MannerStage {
  if (reviewCount < 3) return 'NEW'
  if (score < 30) return 'STARVING'
  if (score < 50) return 'PECKISH'
  if (score < 70) return 'STEADY'
  if (score < 85) return 'FULL'
  return 'HAPPY'
}

async function ensureMannerProfile(db: ReturnType<typeof getDb>, userId: string): Promise<void> {
  await db.insert(mannerProfiles).values({ userId }).onConflictDoNothing({ target: mannerProfiles.userId })
}

/**
 * userId가 받은 리뷰 중 아직 반영 안 된(appliedAt is null) 건을 찾아, "상대도 이미 제출했거나
 * visibleAfter(48시간)가 지난" 건만 골라 점수에 반영한다. 배치/크론이 아니라 해당 유저의 매너
 * 데이터를 조회·평가 제출할 때마다 호출되는 lazy 정산 — computeEffectiveStatus와 같은 패턴.
 */
async function applyDueMannerReviews(db: ReturnType<typeof getDb>, userId: string): Promise<void> {
  const pending = await db
    .select({
      id: mannerReviews.id,
      potId: mannerReviews.potId,
      reviewerId: mannerReviews.reviewerId,
      revieweeId: mannerReviews.revieweeId,
      rating: mannerReviews.rating,
      visibleAfter: mannerReviews.visibleAfter,
    })
    .from(mannerReviews)
    .where(and(eq(mannerReviews.revieweeId, userId), isNull(mannerReviews.appliedAt)))

  if (pending.length === 0) return

  const now = Date.now()
  for (const row of pending) {
    let due = row.visibleAfter.getTime() <= now
    if (!due) {
      const [counterpart] = await db
        .select({ id: mannerReviews.id })
        .from(mannerReviews)
        .where(
          and(
            eq(mannerReviews.potId, row.potId),
            eq(mannerReviews.reviewerId, row.revieweeId),
            eq(mannerReviews.revieweeId, row.reviewerId),
          ),
        )
        .limit(1)
      due = Boolean(counterpart)
    }
    if (!due) continue

    await ensureMannerProfile(db, userId)

    const delta = MANNER_RATING_DELTA[row.rating]
    await db
      .update(mannerProfiles)
      .set({
        score: sql`LEAST(100, GREATEST(0, ${mannerProfiles.score} + ${delta}))`,
        reviewCount: sql`${mannerProfiles.reviewCount} + 1`,
        positiveCount: sql`${mannerProfiles.positiveCount} + ${row.rating === 'GOOD' ? 1 : 0}`,
        negativeCount: sql`${mannerProfiles.negativeCount} + ${row.rating === 'BAD' ? 1 : 0}`,
        updatedAt: new Date(),
      })
      .where(eq(mannerProfiles.userId, userId))

    await db.insert(mannerEvents).values({ userId, reviewId: row.id, reasonCode: 'PEER_REVIEW', delta: String(delta) })
    await db.update(mannerReviews).set({ appliedAt: new Date() }).where(eq(mannerReviews.id, row.id))
  }
}

/** 많이 받은 긍정 태그 상위 3개 — text[] 컬럼이라 unnest 집계는 raw SQL로 처리한다 */
async function getTopPositiveTags(userId: string, limit = 3): Promise<string[]> {
  const db = getDb()
  const result = await db.execute<{ tag: string }>(sql`
    SELECT tag, count(*) AS cnt
    FROM manner_reviews, unnest(tags) AS tag
    WHERE reviewee_id = ${userId} AND rating = 'GOOD' AND applied_at IS NOT NULL
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT ${limit}
  `)
  return result.rows.map((r) => r.tag)
}

export async function getMannerProfile(userId: string): Promise<MannerProfile> {
  const db = getDb()
  await ensureMannerProfile(db, userId)
  await applyDueMannerReviews(db, userId)

  const [row] = await db
    .select({
      score: mannerProfiles.score,
      reviewCount: mannerProfiles.reviewCount,
      avatarColor: mannerProfiles.avatarColor,
      avatarAccessory: mannerProfiles.avatarAccessory,
    })
    .from(mannerProfiles)
    .where(eq(mannerProfiles.userId, userId))
    .limit(1)

  const reviewCount = row?.reviewCount ?? 0
  const scoreNum = row ? Number(row.score) : 50
  const stage = computeMannerStage(scoreNum, reviewCount)
  const topTags = reviewCount < 3 ? [] : await getTopPositiveTags(userId)

  return {
    score: reviewCount < 3 ? null : scoreNum,
    stage,
    reviewCount,
    topTags,
    avatarColor: (row?.avatarColor ?? 'NAVY') as MannerAvatarColor,
    avatarAccessory: (row?.avatarAccessory ?? 'NONE') as MannerAvatarAccessory,
  }
}

/**
 * 참여자 목록·참여 신청 관리 화면(v2.13) 등 여러 명을 한 번에 그릴 때 쓰는 가벼운 배치 조회.
 * getMannerProfile()과 달리 applyDueMannerReviews()를 실행하지 않는다 — 목록 렌더링마다
 * DB 쓰기가 일어나면 안 되고(조회 성능), 지연 반영은 해당 유저의 마이페이지/프로필 화면
 * 접근 시 자연히 정리된다. 프로필 행이 아직 없는 유저는 기본값(NEW/NAVY/NONE)으로 채운다.
 */
export async function getMannerAvatarsForUsers(userIds: string[]): Promise<Map<string, MannerAvatarInfo>> {
  const map = new Map<string, MannerAvatarInfo>()
  const uniqueIds = [...new Set(userIds)]
  if (uniqueIds.length === 0) return map

  const rows = await getDb()
    .select({
      userId: mannerProfiles.userId,
      score: mannerProfiles.score,
      reviewCount: mannerProfiles.reviewCount,
      avatarColor: mannerProfiles.avatarColor,
      avatarAccessory: mannerProfiles.avatarAccessory,
    })
    .from(mannerProfiles)
    .where(inArray(mannerProfiles.userId, uniqueIds))

  for (const row of rows) {
    map.set(row.userId, {
      stage: computeMannerStage(Number(row.score), row.reviewCount),
      avatarColor: row.avatarColor as MannerAvatarColor,
      avatarAccessory: row.avatarAccessory as MannerAvatarAccessory,
    })
  }
  for (const id of uniqueIds) {
    if (!map.has(id)) map.set(id, { stage: 'NEW', avatarColor: 'NAVY', avatarAccessory: 'NONE' })
  }
  return map
}

/** 아바타 색상·소품 변경(v2.9, P1) — 매너 단계 표정은 여기서 못 바꾼다(stage는 계산값) */
export async function updateMannerAvatar(
  userId: string,
  avatarColor: MannerAvatarColor,
  avatarAccessory: MannerAvatarAccessory,
): Promise<void> {
  const db = getDb()
  await ensureMannerProfile(db, userId)
  await db
    .update(mannerProfiles)
    .set({ avatarColor, avatarAccessory, updatedAt: new Date() })
    .where(eq(mannerProfiles.userId, userId))
}

/** 공동주문 완료(ORDERED) 후 viewer가 평가할 수 있는 대상과 제출 여부(§7~8) */
export async function getMannerReviewStatus(potId: string, viewerId: string): Promise<MannerReviewStatus> {
  const db = getDb()

  const [pot] = await db
    .select({ hostId: pots.hostId, status: pots.status, orderedAt: pots.orderedAt })
    .from(pots)
    .where(eq(pots.id, potId))
    .limit(1)

  if (!pot) return { eligible: false, reason: 'POT_NOT_FOUND', targets: [] }
  if (pot.status !== 'ORDERED' || !pot.orderedAt) {
    return { eligible: false, reason: 'NOT_COMPLETED', targets: [] }
  }
  if (Date.now() > pot.orderedAt.getTime() + MANNER_REVIEW_WINDOW_MS) {
    return { eligible: false, reason: 'REVIEW_WINDOW_EXPIRED', targets: [] }
  }

  const approvedMembers = await db
    .select({ userId: participations.userId, nickname: users.nickname })
    .from(participations)
    .innerJoin(users, eq(participations.userId, users.id))
    .where(and(eq(participations.potId, potId), eq(participations.approvalStatus, 'APPROVED')))

  if (!approvedMembers.some((m) => m.userId === viewerId)) {
    return { eligible: false, reason: 'NOT_A_MEMBER', targets: [] }
  }

  const isHost = pot.hostId === viewerId
  const candidates = isHost
    ? approvedMembers.filter((m) => m.userId !== viewerId)
    : approvedMembers.filter((m) => m.userId === pot.hostId)

  if (candidates.length === 0) return { eligible: false, reason: 'NO_TARGETS', targets: [] }

  const existingReviews = await db
    .select({ revieweeId: mannerReviews.revieweeId })
    .from(mannerReviews)
    .where(and(eq(mannerReviews.potId, potId), eq(mannerReviews.reviewerId, viewerId)))

  const reviewedSet = new Set(existingReviews.map((r) => r.revieweeId))

  // §12-3: 평가 화면은 대상의 현재 매너 배지도 함께 보여준다 — 이미 공개 프로필(/users/:id)에서
  // 누구나 볼 수 있는 정보라 평가 화면에 노출해도 §11(개별 평가 비공개) 원칙과 충돌하지 않는다.
  const targets: MannerReviewTarget[] = await Promise.all(
    candidates.map(async (c) => ({
      userId: c.userId,
      nickname: c.nickname,
      alreadyReviewed: reviewedSet.has(c.userId),
      manner: await getMannerProfile(c.userId),
    })),
  )

  return { eligible: true, targets }
}

/** 매너평가 제출 — 자격 재검증부터 반영까지 서버에서만 수행한다. */
export async function submitMannerReview(
  potId: string,
  reviewerId: string,
  revieweeId: string,
  rating: MannerRating,
  tags: string[],
): Promise<{ ok: true } | { ok: false; code: string; error: string }> {
  if (reviewerId === revieweeId) {
    return { ok: false, code: 'SELF_REVIEW', error: '자기 자신은 평가할 수 없습니다.' }
  }

  const status = await getMannerReviewStatus(potId, reviewerId)
  if (!status.eligible) {
    return { ok: false, code: status.reason ?? 'NOT_ELIGIBLE', error: '지금은 이 공동주문을 평가할 수 없습니다.' }
  }

  const target = status.targets.find((t) => t.userId === revieweeId)
  if (!target) {
    return { ok: false, code: 'INVALID_TARGET', error: '평가할 수 없는 대상입니다.' }
  }
  if (target.alreadyReviewed) {
    return { ok: false, code: 'ALREADY_REVIEWED', error: '이미 평가를 남긴 상대입니다.' }
  }

  const db = getDb()

  try {
    await db.insert(mannerReviews).values({
      potId,
      reviewerId,
      revieweeId,
      rating,
      tags,
      visibleAfter: new Date(Date.now() + MANNER_REVIEW_REVEAL_MS),
    })
  } catch (err) {
    if (getPgErrorCode(err) === '23505') {
      return { ok: false, code: 'ALREADY_REVIEWED', error: '이미 평가를 남긴 상대입니다.' }
    }
    throw err
  }

  await applyDueMannerReviews(db, revieweeId)
  await applyDueMannerReviews(db, reviewerId)

  return { ok: true }
}

/** 관리자 제재 감점량(운영정책) — 정지(SUSPENDED)·비활성(DISABLED) 전환 1회당 적용, 일반 평가(§10)와 구분 */
const ADMIN_SANCTION_DELTA = -10

/**
 * 관리자가 신고를 검토해 계정을 실제로 제재할 때만 호출한다 — 신고 접수만으로는 절대 호출하지 않는다(§11).
 * 동료 평가(applyDueMannerReviews)와 달리 반영 지연 없이 즉시 적용하고, manner_events에
 * 'ADMIN_SANCTION' 사유로 기록해 일반 평가와 구분한다.
 */
export async function applyAdminSanction(userId: string): Promise<void> {
  const db = getDb()
  await ensureMannerProfile(db, userId)

  await db
    .update(mannerProfiles)
    .set({
      score: sql`LEAST(100, GREATEST(0, ${mannerProfiles.score} + ${ADMIN_SANCTION_DELTA}))`,
      updatedAt: new Date(),
    })
    .where(eq(mannerProfiles.userId, userId))

  await db.insert(mannerEvents).values({
    userId,
    reviewId: null,
    reasonCode: 'ADMIN_SANCTION',
    delta: String(ADMIN_SANCTION_DELTA),
  })
}

/** 공개 프로필 화면(§12-2)용 최소 사용자 조회 */
export async function getPublicUserProfile(userId: string): Promise<{ id: string; nickname: string } | undefined> {
  const db = getDb()
  const [row] = await db.select({ id: users.id, nickname: users.nickname }).from(users).where(eq(users.id, userId)).limit(1)
  return row
}

/** 완료(ORDERED)된 공동주문에 승인 멤버로 참여한 횟수(호스트 포함) — §12-2 "완료한 공동주문 횟수" */
export async function getCompletedPotCount(userId: string): Promise<number> {
  const db = getDb()
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(participations)
    .innerJoin(pots, eq(participations.potId, pots.id))
    .where(
      and(
        eq(participations.userId, userId),
        eq(participations.approvalStatus, 'APPROVED'),
        eq(pots.status, 'ORDERED'),
      ),
    )
  return cnt
}

// ─────────────────────────────────────────────────────────────
// 친구 기능(신규) — "이미 한번 같이 모집한 사람들이 편하게 다시 모일 수 있게" 하는 것이 목적이라
// 친구 신청은 같은 공동주문에 함께(둘 다 APPROVED로) 참여했던 사이에서만 허용한다. 낯선 사람과의
// 오픈 DM은 금지 — DM방도 친구 사이에서만 새로 만들 수 있다(한번 만들어지면 이후 삭제해도 방 자체는
// 남는다, 아래 getOrCreateDmRoom 참고).
// ─────────────────────────────────────────────────────────────

/** 두 유저가 같은 공동주문에 함께(둘 다 APPROVED로) 참여한 적이 있는지 — 친구 신청 자격 검증용 */
async function haveSharedPot(userAId: string, userBId: string): Promise<boolean> {
  const db = getDb()
  const potsA = await db
    .select({ potId: participations.potId })
    .from(participations)
    .where(and(eq(participations.userId, userAId), eq(participations.approvalStatus, 'APPROVED')))
  if (potsA.length === 0) return false

  const potIdsA = new Set(potsA.map((p) => p.potId))
  const potsB = await db
    .select({ potId: participations.potId })
    .from(participations)
    .where(and(eq(participations.userId, userBId), eq(participations.approvalStatus, 'APPROVED')))

  return potsB.some((p) => potIdsA.has(p.potId))
}

/** userAId → userBId 방향의 차단이 있는지 (방향성 있음 — §친구 기능, 차단당한 쪽만 전송 불가) */
async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const db = getDb()
  const [row] = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
    .limit(1)
  return Boolean(row)
}

async function isBlockedEitherWay(userAId: string, userBId: string): Promise<boolean> {
  const [aBlockedB, bBlockedA] = await Promise.all([isBlocked(userAId, userBId), isBlocked(userBId, userAId)])
  return aBlockedB || bBlockedA
}

async function findFriendRequestRow(userAId: string, userBId: string) {
  const db = getDb()
  const [row] = await db
    .select()
    .from(friendRequests)
    .where(
      or(
        and(eq(friendRequests.requesterId, userAId), eq(friendRequests.addresseeId, userBId)),
        and(eq(friendRequests.requesterId, userBId), eq(friendRequests.addresseeId, userAId)),
      ),
    )
    .limit(1)
  return row
}

async function areFriends(userAId: string, userBId: string): Promise<boolean> {
  const row = await findFriendRequestRow(userAId, userBId)
  return row?.status === 'ACCEPTED'
}

/** 프로필 화면 등에서 어떤 액션 버튼을 보여줄지 판단 */
export async function getFriendshipStatus(viewerId: string, otherUserId: string): Promise<FriendshipStatus> {
  if (viewerId === otherUserId) return 'NONE'

  const [blockedByMe, blockedByThem] = await Promise.all([
    isBlocked(viewerId, otherUserId),
    isBlocked(otherUserId, viewerId),
  ])
  if (blockedByMe) return 'BLOCKED_BY_ME'
  if (blockedByThem) return 'BLOCKED_BY_THEM'

  const row = await findFriendRequestRow(viewerId, otherUserId)
  if (!row) return 'NONE'
  if (row.status === 'ACCEPTED') return 'FRIEND'
  return row.requesterId === viewerId ? 'PENDING_OUT' : 'PENDING_IN'
}

/** 프로필 화면용 — 관계 상태 + "친구 신청" 버튼을 보여줘도 되는지(같은 공동주문을 함께한 사이인지) */
export async function getFriendshipContext(
  viewerId: string,
  otherUserId: string,
): Promise<{ status: FriendshipStatus; canRequest: boolean; requestId?: string }> {
  const status = await getFriendshipStatus(viewerId, otherUserId)
  if (status === 'PENDING_IN') {
    const row = await findFriendRequestRow(viewerId, otherUserId)
    return { status, canRequest: false, requestId: row?.id }
  }
  const canRequest = status === 'NONE' && (await haveSharedPot(viewerId, otherUserId))
  return { status, canRequest }
}

/** 마이페이지 "친구 목록" 탭 */
export async function listFriends(userId: string): Promise<FriendSummary[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: friendRequests.id,
      requesterId: friendRequests.requesterId,
      addresseeId: friendRequests.addresseeId,
      requesterNickname: users.nickname, // placeholder, overwritten below per-row
    })
    .from(friendRequests)
    .innerJoin(users, eq(users.id, friendRequests.requesterId))
    .where(
      and(
        eq(friendRequests.status, 'ACCEPTED'),
        or(eq(friendRequests.requesterId, userId), eq(friendRequests.addresseeId, userId)),
      ),
    )

  const otherUserIds = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId))
  if (otherUserIds.length === 0) return []

  const otherUsers = await db.select({ id: users.id, nickname: users.nickname }).from(users).where(inArray(users.id, otherUserIds))
  const nicknameMap = new Map(otherUsers.map((u) => [u.id, u.nickname]))
  const mannerMap = await getMannerAvatarsForUsers(otherUserIds)

  return rows.map((r) => {
    const otherUserId = r.requesterId === userId ? r.addresseeId : r.requesterId
    return {
      friendRequestId: r.id,
      userId: otherUserId,
      nickname: nicknameMap.get(otherUserId) ?? '',
      manner: mannerMap.get(otherUserId),
    }
  })
}

/** 마이페이지 "친구 신청" 탭 — 내가 받은 대기 중인 신청만 */
export async function listIncomingFriendRequests(userId: string): Promise<FriendRequestSummary[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: friendRequests.id,
      requesterId: friendRequests.requesterId,
      requesterNickname: users.nickname,
      createdAt: friendRequests.createdAt,
    })
    .from(friendRequests)
    .innerJoin(users, eq(users.id, friendRequests.requesterId))
    .where(and(eq(friendRequests.addresseeId, userId), eq(friendRequests.status, 'PENDING')))
    .orderBy(desc(friendRequests.createdAt))

  const mannerMap = await getMannerAvatarsForUsers(rows.map((r) => r.requesterId))

  return rows.map((r) => ({
    requestId: r.id,
    userId: r.requesterId,
    nickname: r.requesterNickname,
    manner: mannerMap.get(r.requesterId),
    createdAt: r.createdAt.toISOString(),
  }))
}

export type SendFriendRequestResult =
  | { ok: true; status: 'PENDING' | 'ACCEPTED' }
  | { ok: false; code: 'SELF' | 'NOT_ELIGIBLE' | 'BLOCKED' | 'ALREADY_FRIENDS' | 'ALREADY_PENDING'; error: string }

/**
 * 친구 신청 — 같은 공동주문에 함께 참여했던 사이만 가능(§친구 기능, 낯선 사람과의 오픈 DM 방지).
 * 상대가 이미 나에게 신청을 보내둔 상태라면 새로 만들지 않고 바로 수락 처리한다.
 */
export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<SendFriendRequestResult> {
  if (requesterId === addresseeId) {
    return { ok: false, code: 'SELF', error: '자기 자신에게는 친구 신청을 보낼 수 없습니다.' }
  }

  if (await isBlockedEitherWay(requesterId, addresseeId)) {
    return { ok: false, code: 'BLOCKED', error: '차단 관계가 있어 친구 신청을 보낼 수 없습니다.' }
  }

  if (!(await haveSharedPot(requesterId, addresseeId))) {
    return { ok: false, code: 'NOT_ELIGIBLE', error: '함께 공동주문에 참여했던 사이만 친구 신청을 보낼 수 있어요.' }
  }

  const db = getDb()
  const existing = await findFriendRequestRow(requesterId, addresseeId)

  if (existing) {
    if (existing.status === 'ACCEPTED') {
      return { ok: false, code: 'ALREADY_FRIENDS', error: '이미 친구예요.' }
    }
    if (existing.requesterId === requesterId) {
      return { ok: false, code: 'ALREADY_PENDING', error: '이미 신청을 보냈어요. 상대의 응답을 기다려주세요.' }
    }
    // 상대가 이미 나에게 신청해둔 상태 → 내가 신청하는 순간 서로 원하는 것이므로 바로 수락 처리
    await db.update(friendRequests).set({ status: 'ACCEPTED', respondedAt: new Date() }).where(eq(friendRequests.id, existing.id))
    const me = await getPublicUserProfile(requesterId)
    await createNotification(db, {
      recipientId: addresseeId,
      type: 'FRIEND_REQUEST_ACCEPTED',
      title: '친구가 되었어요',
      body: `${me?.nickname ?? '상대방'}님과 친구가 되었어요.`,
      actionPath: '/my/friends',
      dedupeKey: `FRIEND_REQUEST_ACCEPTED:${existing.id}:${addresseeId}`,
    })
    return { ok: true, status: 'ACCEPTED' }
  }

  // 상대가 "친구신청 자동수락"을 켜뒀다면 대기 없이 바로 친구가 된다(마이페이지 > 환경설정 > 친구 설정).
  const [addresseePrefs] = await db
    .select({ autoAcceptFriendRequests: userPreferences.autoAcceptFriendRequests })
    .from(userPreferences)
    .where(eq(userPreferences.userId, addresseeId))
    .limit(1)
  const autoAccept = addresseePrefs?.autoAcceptFriendRequests ?? false

  const me = await getPublicUserProfile(requesterId)

  if (autoAccept) {
    const [row] = await db
      .insert(friendRequests)
      .values({ requesterId, addresseeId, status: 'ACCEPTED', respondedAt: new Date() })
      .returning()
    await createNotification(db, {
      recipientId: addresseeId,
      type: 'FRIEND_REQUEST_ACCEPTED',
      title: '친구가 되었어요',
      body: `${me?.nickname ?? '상대방'}님과 친구가 되었어요.`,
      actionPath: '/my/friends',
      dedupeKey: `FRIEND_REQUEST_ACCEPTED:${row.id}:${addresseeId}`,
    })
    return { ok: true, status: 'ACCEPTED' }
  }

  const [row] = await db.insert(friendRequests).values({ requesterId, addresseeId }).returning()
  await createNotification(db, {
    recipientId: addresseeId,
    type: 'FRIEND_REQUEST_RECEIVED',
    title: '친구 신청이 도착했어요',
    body: `${me?.nickname ?? '누군가'}님이 친구 신청을 보냈어요.`,
    actionPath: '/my/friends',
    dedupeKey: `FRIEND_REQUEST_RECEIVED:${row.id}`,
  })
  return { ok: true, status: 'PENDING' }
}

export type RespondFriendRequestResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'NOT_PENDING'; error: string }

/** 친구 신청 수락/거절 — 거절은 행 자체를 지운다(나중에 다시 신청 가능하게). */
export async function respondToFriendRequest(
  requestId: string,
  viewerId: string,
  action: 'accept' | 'reject',
): Promise<RespondFriendRequestResult> {
  const db = getDb()
  const [row] = await db.select().from(friendRequests).where(eq(friendRequests.id, requestId)).limit(1)
  if (!row) return { ok: false, code: 'NOT_FOUND', error: '존재하지 않는 친구 신청입니다.' }
  if (row.addresseeId !== viewerId) return { ok: false, code: 'FORBIDDEN', error: '내가 받은 신청만 처리할 수 있습니다.' }
  if (row.status !== 'PENDING') return { ok: false, code: 'NOT_PENDING', error: '이미 처리된 신청입니다.' }

  if (action === 'reject') {
    await db.delete(friendRequests).where(eq(friendRequests.id, requestId))
    return { ok: true }
  }

  await db.update(friendRequests).set({ status: 'ACCEPTED', respondedAt: new Date() }).where(eq(friendRequests.id, requestId))
  const me = await getPublicUserProfile(viewerId)
  await createNotification(db, {
    recipientId: row.requesterId,
    type: 'FRIEND_REQUEST_ACCEPTED',
    title: '친구가 되었어요',
    body: `${me?.nickname ?? '상대방'}님과 친구가 되었어요.`,
    actionPath: '/my/friends',
    dedupeKey: `FRIEND_REQUEST_ACCEPTED:${requestId}`,
  })
  return { ok: true }
}

/** 친구 삭제 — 메신저 제한은 없고, 이후 이 사람이 보내는 DM에는 배너로 "친구로 등록되지 않은
 *  사용자입니다"만 뜬다(§친구 기능). 다시 신청하면 새로 친구가 될 수 있도록 행을 지운다. */
export async function unfriend(userId: string, otherUserId: string): Promise<void> {
  const db = getDb()
  const row = await findFriendRequestRow(userId, otherUserId)
  if (row && row.status === 'ACCEPTED') {
    await db.delete(friendRequests).where(eq(friendRequests.id, row.id))
  }
}

/** 차단 — 기존 친구 관계도 함께 끊는다. 차단당한 쪽만 나에게 메시지를 보낼 수 없게 된다. */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) return
  const db = getDb()
  await db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing()

  const row = await findFriendRequestRow(blockerId, blockedId)
  if (row) {
    await db.delete(friendRequests).where(eq(friendRequests.id, row.id))
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const db = getDb()
  await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
}

/** 마이페이지 "차단 목록" — 친구 화면 안에서 같이 관리 */
export async function listBlockedUsers(userId: string): Promise<FriendSummary[]> {
  const db = getDb()
  const rows = await db
    .select({ id: userBlocks.id, blockedId: userBlocks.blockedId, nickname: users.nickname })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, userId))

  const mannerMap = await getMannerAvatarsForUsers(rows.map((r) => r.blockedId))
  return rows.map((r) => ({
    friendRequestId: r.id,
    userId: r.blockedId,
    nickname: r.nickname,
    manner: mannerMap.get(r.blockedId),
  }))
}

export type GetOrCreateDmRoomResult =
  | { ok: true; roomId: string }
  | { ok: false; code: 'NOT_FRIENDS'; error: string }

/**
 * 친구 DM방 조회 또는 생성 — 방을 새로 "여는" 것(메시지 보내기 버튼)은 친구 사이에서만 가능하다.
 * 한번 만들어진 방은 이후 친구를 삭제해도 없어지지 않는다 — 삭제당한 상대가 다시 말 걸 때 배너로만
 * 안내한다(§친구 기능). dmUserAId < dmUserBId로 정렬해 저장해 같은 쌍에 방이 중복 생성되지 않는다.
 */
export async function getOrCreateDmRoom(userAId: string, userBId: string): Promise<GetOrCreateDmRoomResult> {
  const db = getDb()
  const [lo, hi] = userAId < userBId ? [userAId, userBId] : [userBId, userAId]

  const [existing] = await db
    .select({ id: chatRooms.id })
    .from(chatRooms)
    .where(and(eq(chatRooms.type, 'DM'), eq(chatRooms.dmUserAId, lo), eq(chatRooms.dmUserBId, hi)))
    .limit(1)
  if (existing) return { ok: true, roomId: existing.id }

  if (!(await areFriends(userAId, userBId))) {
    return { ok: false, code: 'NOT_FRIENDS', error: '친구 사이에서만 메시지를 시작할 수 있어요.' }
  }

  const [created] = await db
    .insert(chatRooms)
    .values({ type: 'DM', dmUserAId: lo, dmUserBId: hi, title: '다이렉트 메시지' })
    .onConflictDoNothing({ target: [chatRooms.dmUserAId, chatRooms.dmUserBId] })
    .returning()

  if (created) return { ok: true, roomId: created.id }

  // 동시에 두 요청이 방을 만들려다 경합한 경우 — 방금 다른 요청이 만든 방을 다시 조회
  const [raced] = await db
    .select({ id: chatRooms.id })
    .from(chatRooms)
    .where(and(eq(chatRooms.type, 'DM'), eq(chatRooms.dmUserAId, lo), eq(chatRooms.dmUserBId, hi)))
    .limit(1)
  if (raced) return { ok: true, roomId: raced.id }
  throw new Error('Failed to create or find DM room')
}

/** 메시지 전송 직전 차단 검사 — DM방에서 상대가 나를 차단했으면 전송을 막는다(§친구 기능). */
export async function isSenderBlockedByRecipient(senderId: string, recipientId: string): Promise<boolean> {
  return isBlocked(recipientId, senderId)
}

export type InvitePotFriendsResult =
  | { ok: true; invitedCount: number }
  | { ok: false; code: 'FORBIDDEN' | 'NOT_FOUND'; error: string }

/**
 * 모집방에 친구 초대 — 승인 없이 바로 참여시키지 않고, 초대 알림만 보낸다(§친구 기능). 친구가 아닌
 * 유저 id가 섞여 들어와도 서버가 걸러서 실제 친구에게만 보낸다. 이미 참여(신청 포함)한 친구는 건너뛴다.
 */
export async function invitePotFriends(
  potId: string,
  hostId: string,
  friendUserIds: string[],
): Promise<InvitePotFriendsResult> {
  const db = getDb()
  const [pot] = await db.select({ hostId: pots.hostId, storeName: pots.storeName }).from(pots).where(eq(pots.id, potId)).limit(1)
  if (!pot) return { ok: false, code: 'NOT_FOUND', error: '존재하지 않는 공동주문입니다.' }
  if (pot.hostId !== hostId) return { ok: false, code: 'FORBIDDEN', error: '모집자만 친구를 초대할 수 있습니다.' }

  const uniqueIds = [...new Set(friendUserIds)].filter((id) => id !== hostId)
  if (uniqueIds.length === 0) return { ok: true, invitedCount: 0 }

  const myFriends = await listFriends(hostId)
  const friendIdSet = new Set(myFriends.map((f) => f.userId))
  const eligibleIds = uniqueIds.filter((id) => friendIdSet.has(id))
  if (eligibleIds.length === 0) return { ok: true, invitedCount: 0 }

  const existingParticipations = await db
    .select({ userId: participations.userId })
    .from(participations)
    .where(and(eq(participations.potId, potId), inArray(participations.userId, eligibleIds)))
  const alreadyInPot = new Set(existingParticipations.map((p) => p.userId))
  const toInvite = eligibleIds.filter((id) => !alreadyInPot.has(id))
  if (toInvite.length === 0) return { ok: true, invitedCount: 0 }

  const host = await getPublicUserProfile(hostId)
  await createNotificationBulk(
    db,
    toInvite.map((uid) => ({
      recipientId: uid,
      type: 'POT_INVITED' as const,
      potId,
      title: '공동주문에 초대됐어요',
      body: `${host?.nickname ?? '친구'}님이 ${pot.storeName} 공동주문에 초대했어요.`,
      actionPath: `/pots/${potId}`,
      dedupeKey: `POT_INVITED:${potId}:${uid}`,
    })),
  )

  return { ok: true, invitedCount: toInvite.length }
}
