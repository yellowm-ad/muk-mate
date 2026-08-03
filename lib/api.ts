// ─────────────────────────────────────────────────────────────
// 클라이언트(브라우저) 전용 데이터 접근 계층 — 'use client' 컴포넌트에서 호출한다.
// 여기 있는 함수는 전부 fetch()로 실제 API를 부른다. DB(@/lib/db)나 인증(@/auth)을
// 직접 import하지 않는다 — 그러면 서버 전용 코드가 브라우저 번들에 끼어 들어가려다
// 빌드가 깨진다. 서버 컴포넌트가 필요로 하는 조회는 lib/server-data.ts를 쓴다.
//
// ─────────────────────────────────────────────────────────────
import type { AppNotification, Message, Participation, Place, Pot, PotStatus, RoomReadEntry, ZoneCode } from '@/lib/types'

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? '요청에 실패했습니다.'
    throw new Error(message)
  }
  return data as T
}

/** 공동주문 신규 모집글 등록 — POST /api/pots */
export async function createPot(input: {
  storeName: string
  storeAddress?: string
  storeLat?: number
  storeLng?: number
  orderSummary: string
  zoneCode: ZoneCode
  targetType: 'HEADCOUNT' | 'AMOUNT'
  targetValue: number
  deliveryFee: number
  deadlineMinutes: number
  pickupMinutes: number
  pickupName: string
  pickupAddress?: string
  pickupLat?: number
  pickupLng?: number
  pickupNote?: string
  extraNote?: string
}): Promise<Pot> {
  const res = await fetch('/api/pots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJsonResponse<{ pot: Pot }>(res)
  return data.pot
}

/** 모집글 상태 변경(마감/완료/취소) — PATCH /api/pots/:id, 모집자 전용 */
export async function updatePotStatus(potId: string, status: PotStatus): Promise<Pot> {
  const res = await fetch(`/api/pots/${potId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  const data = await parseJsonResponse<{ pot: Pot }>(res)
  return data.pot
}

/** 모집글 삭제 — DELETE /api/pots/:id, 모집자 전용 · 참여자가 없을 때만 가능 */
export async function deletePot(potId: string): Promise<void> {
  const res = await fetch(`/api/pots/${potId}`, {
    method: 'DELETE',
  })
  await parseJsonResponse<{ ok: boolean }>(res)
}

/** 참여 신청 — POST /api/pots/:id/join */
export async function requestJoinPot(potId: string, menuMemo?: string): Promise<Participation> {
  const res = await fetch(`/api/pots/${potId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menuMemo }),
  })
  const data = await parseJsonResponse<{ participation: Participation }>(res)
  return data.participation
}

/** 참여 신청 취소 / 나갈 때 — DELETE /api/pots/:id/join */
export async function cancelJoinPot(potId: string): Promise<void> {
  const res = await fetch(`/api/pots/${potId}/join`, {
    method: 'DELETE',
  })
  await parseJsonResponse<{ ok: boolean }>(res)
}

/** 호스트 수락/거절 — PATCH /api/pots/:id/members/:userId */
export async function decideMemberApplication(
  potId: string,
  targetUserId: string,
  action: 'approve' | 'reject',
): Promise<Participation> {
  const res = await fetch(`/api/pots/${potId}/members/${targetUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  const data = await parseJsonResponse<{ participation: Participation }>(res)
  return data.participation
}

/** 방장용 신청 목록 조회 — GET /api/pots/:id/requests */
export async function getPotRequests(
  potId: string,
): Promise<{ items: { userId: string; nickname: string; menuMemo: string; requestedAt: string }[] }> {
  const res = await fetch(`/api/pots/${potId}/requests`)
  return parseJsonResponse(res)
}

/** 기본정보(닉네임/활동지역) 수정 — PATCH /api/me */
export async function updateProfile(input: { nickname: string; zoneCode: ZoneCode }): Promise<{
  nickname: string
  zoneCode: ZoneCode
}> {
  const res = await fetch('/api/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJsonResponse<{ user: { nickname: string; zoneCode: ZoneCode } }>(res)
  return data.user
}

/** 비밀번호 변경 — PATCH /api/me/password, 현재 비밀번호 확인 후 변경 */
export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  const res = await fetch('/api/me/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 회원 탈퇴(소프트) — DELETE /api/me, 현재 비밀번호 확인 후 계정 비활성화 */
export async function withdrawAccount(currentPassword: string): Promise<void> {
  const res = await fetch('/api/me', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword }),
  })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 채팅 메시지 증분 조회(폴링) — GET /api/rooms/:id/messages?after= */
export async function getMessages(
  roomId: string,
  afterId = 0,
): Promise<{ messages: Message[]; reads: RoomReadEntry[] }> {
  const res = await fetch(`/api/rooms/${roomId}/messages?after=${afterId}`)
  return parseJsonResponse<{ messages: Message[]; reads: RoomReadEntry[] }>(res)
}

/** 메시지 전송 — POST /api/rooms/:id/messages */
export async function sendMessage(roomId: string, content: string): Promise<Message> {
  const res = await fetch(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  const data = await parseJsonResponse<{ message: Message }>(res)
  return data.message
}

/** 장소 검색 — GET /api/places/search?q=, 카카오 로컬 API 서버 프록시 */
export async function searchPlaces(keyword: string): Promise<Place[]> {
  const q = keyword.trim()
  if (!q) return []
  const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`)
  return parseJsonResponse<Place[]>(res)
}

/** [관리자] 신고 상태·메모 변경 — PATCH /api/admin/reports/:id */
export async function updateReportStatus(
  reportId: string,
  input: { status: 'REVIEWING' | 'RESOLVED' | 'DISMISSED'; adminNote?: string },
): Promise<void> {
  const res = await fetch(`/api/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  await parseJsonResponse<{ report: unknown }>(res)
}

/** [관리자] 계정 상태 변경 — PATCH /api/admin/users/:id */
export async function updateUserAccountStatus(
  userId: string,
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountStatus }),
  })
  await parseJsonResponse<{ user: unknown }>(res)
}

/** [관리자] 모집글 직권 삭제 — DELETE /api/admin/pots/:id, 참여자/방장 조건 무시 */
export async function adminDeletePot(potId: string): Promise<void> {
  const res = await fetch(`/api/admin/pots/${potId}`, {
    method: 'DELETE',
  })
  await parseJsonResponse<{ ok: boolean }>(res)
}

/** 메시지/사용자 신고 등록 — POST /api/reports */
export async function sendReport(input: {
  reportedUserId: string
  roomId?: string
  messageId?: number
  reason: string
  detail?: string
}): Promise<{ ok: boolean; reportId: string }> {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJsonResponse<{ ok: boolean; reportId: string }>(res)
}

/** 내 알림 목록 조회 — GET /api/notifications */
export async function getNotifications(
  cursor?: number,
  limit = 20,
): Promise<{ items: AppNotification[]; nextCursor?: number }> {
  const url = cursor
    ? `/api/notifications?cursor=${cursor}&limit=${limit}`
    : `/api/notifications?limit=${limit}`
  const res = await fetch(url)
  return parseJsonResponse(res)
}

/** 읽지 않은 알림 개수 — GET /api/notifications/unread-count */
export async function getUnreadNotificationCount(): Promise<number> {
  const res = await fetch('/api/notifications/unread-count')
  const data = await parseJsonResponse<{ unreadCount: number }>(res)
  return data.unreadCount
}

/** 알림 단일 읽음 처리 — PATCH /api/notifications/:id/read */
export async function markNotificationAsRead(id: number): Promise<void> {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 모든 알림 읽음 처리 — PATCH /api/notifications/read-all */
export async function markAllNotificationsAsRead(): Promise<void> {
  const res = await fetch('/api/notifications/read-all', {
    method: 'PATCH',
  })
  await parseJsonResponse<{ ok: true }>(res)
}
