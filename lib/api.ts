// ─────────────────────────────────────────────────────────────
// 클라이언트(브라우저) 전용 데이터 접근 계층 — 'use client' 컴포넌트에서 호출한다.
// 여기 있는 함수는 전부 fetch()로 실제 API를 부른다. DB(@/lib/db)나 인증(@/auth)을
// 직접 import하지 않는다 — 그러면 서버 전용 코드가 브라우저 번들에 끼어 들어가려다
// 빌드가 깨진다. 서버 컴포넌트가 필요로 하는 조회는 lib/server-data.ts를 쓴다.
//
// ─────────────────────────────────────────────────────────────
import type {
  AppNotification,
  FriendRequestSummary,
  FriendshipStatus,
  FriendSummary,
  MannerAvatarAccessory,
  MannerAvatarColor,
  MannerProfile,
  MannerRating,
  MannerReviewStatus,
  Message,
  Participation,
  Place,
  Pot,
  PotStatus,
  RoomReadEntry,
  ZoneCode,
} from '@/lib/types'

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
  /** §5-4 분담 금액 계산용(P1, 선택) — 방장 본인의 예상 주문 금액 */
  menuAmount?: number
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

/** 모집글 필드 수정(가게·수령장소·모집방식·활동권역 제외) — PATCH /api/pots/:id, 모집자 전용, OPEN 상태에서만 (ORDER-08) */
export async function updatePot(
  potId: string,
  input: {
    orderSummary: string
    targetValue: number
    deliveryFee: number
    deadlineAt: string
    pickupAt?: string
    pickupNote?: string
    extraNote?: string
  },
): Promise<Pot> {
  const res = await fetch(`/api/pots/${potId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJsonResponse<{ pot: Pot }>(res)
  return data.pot
}

/** 모집글 삭제 — DELETE /api/pots/:id, 모집자 전용 · 참여자가 없거나 전원 거래 완료 확인(ORDERED) 후에만 가능 */
export async function deletePot(potId: string): Promise<void> {
  const res = await fetch(`/api/pots/${potId}`, {
    method: 'DELETE',
  })
  await parseJsonResponse<{ ok: boolean }>(res)
}

/** 거래 완료 확인 — POST /api/pots/:id/complete, 방장 포함 승인 참여자 전용. 전원 확인 시 자동으로 ORDERED 전이 */
export async function confirmPotComplete(
  potId: string,
): Promise<{ allConfirmed: boolean; done: number; total: number }> {
  const res = await fetch(`/api/pots/${potId}/complete`, { method: 'POST' })
  return parseJsonResponse<{ ok: boolean; allConfirmed: boolean; done: number; total: number }>(res)
}

/** 참여 신청 — POST /api/pots/:id/join */
export async function requestJoinPot(potId: string, menuMemo?: string, menuAmount?: number): Promise<Participation> {
  const res = await fetch(`/api/pots/${potId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menuMemo, menuAmount }),
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

/** 아이디 변경: 본인 전북대 이메일로 인증번호 발송 요청 — POST /api/me/login-id/request-code */
export async function requestLoginIdChangeCode(): Promise<void> {
  const res = await fetch('/api/me/login-id/request-code', { method: 'POST' })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 아이디 변경: 인증번호 확인(즉시 피드백용) — POST /api/me/login-id/verify-code */
export async function verifyLoginIdChangeCode(code: string): Promise<void> {
  const res = await fetch('/api/me/login-id/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 아이디 변경: 인증번호 재확인 + 현재 비밀번호 확인 후 실제 변경 — PATCH /api/me/login-id */
export async function changeLoginId(input: { code: string; newLoginId: string; currentPassword: string }): Promise<void> {
  const res = await fetch('/api/me/login-id', {
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
): Promise<{ messages: Message[]; reads: RoomReadEntry[]; deletedMessageIds: number[] }> {
  const res = await fetch(`/api/rooms/${roomId}/messages?after=${afterId}`)
  return parseJsonResponse<{ messages: Message[]; reads: RoomReadEntry[]; deletedMessageIds: number[] }>(res)
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

/** 채팅 삭제 — DELETE /api/rooms/:id/messages, 5분 이내 내 메시지는 전체 삭제, 그 외는 나만 안 보이게 삭제 */
export async function deleteMessages(roomId: string, messageIds: number[]): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageIds }),
  })
  await parseJsonResponse<{ ok: boolean }>(res)
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

/** 내 매너 포만도 조회 — GET /api/me/manner */
export async function getMyManner(): Promise<MannerProfile> {
  const res = await fetch('/api/me/manner')
  const data = await parseJsonResponse<{ manner: MannerProfile }>(res)
  return data.manner
}

/** 다른 사용자의 매너 포만도 조회 — GET /api/users/:id/manner */
export async function getUserManner(userId: string): Promise<MannerProfile> {
  const res = await fetch(`/api/users/${userId}/manner`)
  const data = await parseJsonResponse<{ manner: MannerProfile }>(res)
  return data.manner
}

/** 특정 공동주문에서 내가 평가할 수 있는 대상 조회 — GET /api/pots/:id/manner-review-status */
export async function getMannerReviewStatus(potId: string): Promise<MannerReviewStatus> {
  const res = await fetch(`/api/pots/${potId}/manner-review-status`)
  return parseJsonResponse<MannerReviewStatus>(res)
}

/** 아바타 색상·소품 변경 — PATCH /api/me/avatar */
export async function updateAvatar(input: {
  avatarColor: MannerAvatarColor
  avatarAccessory: MannerAvatarAccessory
}): Promise<MannerProfile> {
  const res = await fetch('/api/me/avatar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJsonResponse<{ manner: MannerProfile }>(res)
  return data.manner
}

/** 매너평가 제출 — POST /api/pots/:id/manner-reviews, 제출 후 수정 불가 */
export async function submitMannerReview(
  potId: string,
  input: { revieweeId: string; rating: MannerRating; tags: string[] },
): Promise<void> {
  const res = await fetch(`/api/pots/${potId}/manner-reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  await parseJsonResponse<{ ok: true }>(res)
}

// ─────────────────────────────────────────────────────────────
// 친구 기능(신규)
// ─────────────────────────────────────────────────────────────

/** 내 친구 목록 — GET /api/friends */
export async function getFriends(): Promise<FriendSummary[]> {
  const res = await fetch('/api/friends')
  const data = await parseJsonResponse<{ friends: FriendSummary[] }>(res)
  return data.friends
}

/** 친구 신청 보내기 — POST /api/friends. 같은 공동주문에 참여했던 사이만 가능 */
export async function sendFriendRequest(targetUserId: string): Promise<{ status: 'PENDING' | 'ACCEPTED' }> {
  const res = await fetch('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId }),
  })
  return parseJsonResponse<{ ok: true; status: 'PENDING' | 'ACCEPTED' }>(res)
}

/** 친구 삭제 — DELETE /api/friends/:userId */
export async function removeFriend(userId: string): Promise<void> {
  const res = await fetch(`/api/friends/${userId}`, { method: 'DELETE' })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 내가 받은 친구 신청 목록 — GET /api/friends/requests */
export async function getFriendRequests(): Promise<FriendRequestSummary[]> {
  const res = await fetch('/api/friends/requests')
  const data = await parseJsonResponse<{ requests: FriendRequestSummary[] }>(res)
  return data.requests
}

/** 친구 신청 수락/거절 — PATCH /api/friends/requests/:requestId */
export async function respondToFriendRequest(requestId: string, action: 'accept' | 'reject'): Promise<void> {
  const res = await fetch(`/api/friends/requests/${requestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 차단 목록 — GET /api/blocks */
export async function getBlockedUsers(): Promise<FriendSummary[]> {
  const res = await fetch('/api/blocks')
  const data = await parseJsonResponse<{ blocked: FriendSummary[] }>(res)
  return data.blocked
}

/** 사용자 차단 — POST /api/blocks. 기존 친구 관계도 함께 끊긴다 */
export async function blockUser(targetUserId: string): Promise<void> {
  const res = await fetch('/api/blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId }),
  })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 차단 해제 — DELETE /api/blocks/:userId */
export async function unblockUser(userId: string): Promise<void> {
  const res = await fetch(`/api/blocks/${userId}`, { method: 'DELETE' })
  await parseJsonResponse<{ ok: true }>(res)
}

/** 특정 사용자와의 관계 상태(친구/신청중/차단 등) — GET /api/users/:id/friendship */
export async function getFriendshipContext(
  userId: string,
): Promise<{ status: FriendshipStatus; canRequest: boolean; requestId?: string }> {
  const res = await fetch(`/api/users/${userId}/friendship`)
  return parseJsonResponse<{ status: FriendshipStatus; canRequest: boolean; requestId?: string }>(res)
}

/** 친구와의 DM방 열기(없으면 새로 생성) — POST /api/dm. 친구 사이에서만 가능 */
export async function openDmWithFriend(targetUserId: string): Promise<{ roomId: string }> {
  const res = await fetch('/api/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId }),
  })
  return parseJsonResponse<{ roomId: string }>(res)
}

/** 모집방에 친구 초대(승인 절차는 그대로, 알림만 감) — POST /api/pots/:id/invite */
export async function invitePotFriends(potId: string, friendUserIds: string[]): Promise<{ invitedCount: number }> {
  const res = await fetch(`/api/pots/${potId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ friendUserIds }),
  })
  return parseJsonResponse<{ ok: true; invitedCount: number }>(res)
}
