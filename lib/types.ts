// 먹메이트(MukMate) 도메인 타입 정의
// 모든 화면/컴포넌트는 이 타입을 기준으로 데이터를 주고받는다.

export type PotStatus = 'OPEN' | 'CLOSED' | 'ORDERED' | 'CANCELED'
export type Approval = 'PENDING' | 'APPROVED' | 'REJECTED'
export type TargetType = 'HEADCOUNT' | 'AMOUNT'
export type RoomType = 'ORDER' | 'COMMUNITY'
export type MessageType = 'TEXT' | 'SYSTEM'

/** 활동 지역 권역 코드 */
export type ZoneCode = 'GUJEONGMUN' | 'SINJEONGMUN' | 'DORM' | 'SADAEBUGO'

export interface Zone {
  code: ZoneCode
  label: string
}

export interface User {
  id: string
  loginId: string
  nickname: string
  zoneCode: ZoneCode
}

export interface Pot {
  id: string
  hostId: string
  hostNickname: string
  zoneCode: ZoneCode
  storeName: string
  storeAddress: string
  orderSummary: string
  targetType: TargetType
  /** HEADCOUNT면 목표 인원, AMOUNT면 목표 금액(원) */
  targetValue: number
  /** 현재 참여 인원 */
  currentCount: number
  /** AMOUNT 타입일 때 현재 모인 금액(원) */
  currentAmount?: number
  deliveryFee: number
  deadlineAt: string
  pickupAt: string
  pickupName: string
  pickupAddress: string
  pickupNote: string
  extraNote: string
  status: PotStatus
  isLocationVerified: boolean
  distanceMeters: number
  createdAt: string
}

export interface Participation {
  id: string
  potId: string
  userId: string
  nickname: string
  applyMessage: string
  menuAmount: number
  approvalStatus: Approval
  createdAt: string
}

export interface ChatRoom {
  id: string
  type: RoomType
  potId: string | null
  title: string
  subtitle?: string
  memberCount?: number
  potStatus?: PotStatus
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

export interface Message {
  id: string
  roomId: string
  senderId: string
  senderNickname: string
  type: MessageType
  content: string
  createdAt: string
  isMine: boolean
}

export interface Place {
  id: string
  name: string
  category: string
  address: string
  distanceMeters: number
}
