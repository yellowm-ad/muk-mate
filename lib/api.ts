// ─────────────────────────────────────────────────────────────
// 데이터 접근 레이어
// 지금은 mock-data를 Promise.resolve로 반환만 한다.
// 백엔드 연동 시 이 파일의 함수 본문만 실제 fetch로 교체하면 된다.
// (컴포넌트는 이 함수들만 호출하고, mock-data를 직접 import 하지 않는다.)
// ─────────────────────────────────────────────────────────────
import {
  CHAT_ROOMS,
  CURRENT_USER_ID,
  FREQUENT_PICKUP_PLACES,
  MESSAGES,
  PARTICIPATIONS,
  PLACES,
  POTS,
  RECENT_PLACE_KEYWORDS,
  USERS,
} from '@/lib/mock-data'
import type {
  ChatRoom,
  Message,
  Participation,
  Place,
  Pot,
  PotStatus,
  User,
  ZoneCode,
} from '@/lib/types'

function delay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

/** 현재 로그인 사용자 */
export async function getCurrentUser(): Promise<User> {
  // TODO: replace with real API call — GET /api/me
  return delay(USERS.find((u) => u.id === CURRENT_USER_ID)!)
}

/** 공동주문 목록 (지역/상태 필터) */
export async function getPots(params?: {
  zone?: ZoneCode
  status?: PotStatus | 'ALL'
}): Promise<Pot[]> {
  // TODO: replace with real API call — GET /api/pots?zone=&status=
  let list = [...POTS]
  if (params?.zone) list = list.filter((p) => p.zoneCode === params.zone)
  if (params?.status && params.status !== 'ALL')
    list = list.filter((p) => p.status === params.status)
  return delay(list)
}

/** 공동주문 상세 */
export async function getPot(id: string): Promise<Pot | undefined> {
  // TODO: replace with real API call — GET /api/pots/:id
  return delay(POTS.find((p) => p.id === id))
}

/** 특정 공동주문의 참여 신청 목록 */
export async function getParticipations(potId: string): Promise<Participation[]> {
  // TODO: replace with real API call — GET /api/pots/:id/participations
  return delay(PARTICIPATIONS.filter((p) => p.potId === potId))
}

/** 내가 만든 공동주문 */
export async function getMyHostedPots(): Promise<Pot[]> {
  // TODO: replace with real API call — GET /api/me/pots?role=host
  return delay(POTS.filter((p) => p.hostId === CURRENT_USER_ID))
}

/** 내가 참여 신청한 공동주문 (신청 + 원본 Pot) */
export async function getMyApplications(): Promise<
  { participation: Participation; pot: Pot }[]
> {
  // TODO: replace with real API call — GET /api/me/participations
  const mine = PARTICIPATIONS.filter((p) => p.userId === CURRENT_USER_ID)
  const joined = mine
    .map((participation) => {
      const pot = POTS.find((p) => p.id === participation.potId)
      return pot ? { participation, pot } : null
    })
    .filter(Boolean) as { participation: Participation; pot: Pot }[]
  return delay(joined)
}

/** 내 채팅방 목록 */
export async function getMyRooms(): Promise<ChatRoom[]> {
  // TODO: replace with real API call — GET /api/me/rooms
  return delay(CHAT_ROOMS)
}

/** 채팅방 단건 */
export async function getRoom(roomId: string): Promise<ChatRoom | undefined> {
  // TODO: replace with real API call — GET /api/rooms/:id
  return delay(CHAT_ROOMS.find((r) => r.id === roomId))
}

/** 채팅 메시지 목록 */
export async function getMessages(roomId: string): Promise<Message[]> {
  // TODO: replace with real API call — GET /api/rooms/:id/messages?after=lastId
  return delay(MESSAGES[roomId] ?? [])
}

/** 장소 검색 (지금은 문자열 필터링만) */
export async function searchPlaces(keyword: string): Promise<Place[]> {
  // TODO: replace with real API call — GET /api/places/search?q=
  const q = keyword.trim()
  if (!q) return delay([])
  return delay(PLACES.filter((p) => p.name.includes(q) || p.category.includes(q)))
}

/** 자주 쓰는 수령 장소 / 최근 검색어 (검색 전 상태용) */
export async function getPlaceSuggestions(): Promise<{
  frequent: Place[]
  recent: string[]
}> {
  // TODO: replace with real API call — GET /api/places/suggestions
  return delay({ frequent: FREQUENT_PICKUP_PLACES, recent: RECENT_PLACE_KEYWORDS })
}
