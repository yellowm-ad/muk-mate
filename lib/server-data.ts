import 'server-only'

import { and, asc, count, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { REMEMBER_GUARD_COOKIE } from '@/lib/auth-constants'
import { getDb } from '@/lib/db'
import { chatRooms, messages, notifications, participations, pots, roomReads, users } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { createNotificationBulk } from '@/lib/notifications'
import { resolveViewerState } from '@/lib/pots/viewer-state'
import type {
  AppNotification,
  ChatRoom,
  Message,
  Participation,
  Pot,
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
    pickupNote: row.pickupNote ?? '',
    extraNote: row.extraNote ?? '',
    // §10-3③: 크론 없이 조회 시점에 마감 여부를 판정한다.
    status: computeEffectiveStatus(row.status, row.deadlineAt),
    // 카카오 로컬 API 검색 결과로 좌표까지 채워진 경우에만 "위치확인" — Phase 3 전까지는 항상 false
    isLocationVerified: Boolean(row.storeLat && row.storeLng),
    // ORDER-10(P1, Phase 6)에서 클라이언트 Geolocation으로 채울 때까지는 표시하지 않음
    distanceMeters: 0,
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

  return visible
    .filter((r) => r.userId !== pot.hostId)
    .map((r) => ({
      id: r.id,
      potId: r.potId,
      userId: r.userId,
      nickname: r.nickname,
      applyMessage: r.applyMessage ?? '',
      menuAmount: r.menuAmount ?? 0,
      approvalStatus: r.approvalStatus,
      createdAt: r.createdAt.toISOString(),
    }))
}

export async function getPendingRequestsForPot(potId: string): Promise<{
  userId: string
  nickname: string
  menuMemo: string
  requestedAt: string
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

  return rows.map((r) => ({
    userId: r.userId,
    nickname: r.nickname,
    menuMemo: r.applyMessage ?? '',
    requestedAt: r.requestedAt.toISOString(),
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

  const allRoomIds = [...orderRoomsRaw.map((r) => r.id), ...communityRoomsRaw.map((r) => r.id)]
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

  return [...orderRooms, ...communityRooms]
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
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(and(eq(messages.roomId, roomId), gt(messages.id, afterId)))
    .orderBy(asc(messages.id))

  return rows.map((r) => ({
    id: String(r.id),
    roomId: r.roomId,
    senderId: r.senderId ?? '',
    senderNickname: r.senderNickname ?? '',
    type: r.type,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    isMine: r.senderId === viewerId,
  }))
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
