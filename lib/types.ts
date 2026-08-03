// 먹메이트(MukMate) 도메인 타입 정의
// 모든 화면/컴포넌트는 이 타입을 기준으로 데이터를 주고받는다.

import type { ViewerState } from '@/types/pot-member'

export type { ViewerState }
export type PotStatus = 'OPEN' | 'CLOSED' | 'ORDERED' | 'CANCELED'
export type Approval = 'PENDING' | 'APPROVED' | 'REJECTED'
export type TargetType = 'HEADCOUNT' | 'AMOUNT'
export type RoomType = 'ORDER' | 'COMMUNITY'
export type MessageType = 'TEXT' | 'SYSTEM'

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
export type ReportReason =
  | 'HARASSMENT'
  | 'SEXUAL_CONTENT'
  | 'SPAM'
  | 'FRAUD'
  | 'NO_SHOW'
  | 'PRIVACY'
  | 'UNSAFE_MEETING'
  | 'OTHER'
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED'

export interface ReportInput {
  reportedUserId: string
  roomId?: string
  messageId?: number
  reason: ReportReason
  detail?: string
}

/** 활동 지역 권역 코드 */
export type ZoneCode = 'GUJEONGMUN' | 'SINJEONGMUN' | 'DORM' | 'SADAEBUGO'

export interface Zone {
  code: ZoneCode
  label: string
}

export type UserRole = 'USER' | 'ADMIN'

export interface User {
  id: string
  loginId: string
  nickname: string
  zoneCode: ZoneCode
  role: UserRole
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
  viewerState?: ViewerState
  approvedCount?: number
  pendingCount?: number
  chatRoomId?: string
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

/** 읽음 표시(v2.5) — ORDER 채팅방 참여자별 마지막으로 읽은 메시지 id */
export interface RoomReadEntry {
  userId: string
  lastReadMessageId: number
}

/** 채팅방 접근 권한 검사 결과 — lib/server-data.ts의 getRoomForViewer가 반환하는 모양 */
export interface RoomAccess {
  id: string
  type: RoomType
  title: string
  pot?: {
    id: string
    storeName: string
    pickupName: string
    pickupAt: string
    status: PotStatus
  }
}

export interface Place {
  id: string
  name: string
  category: string
  address: string
  /** 위도 */
  lat: number
  /** 경도 */
  lng: number
}

export type NotificationType =
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_RECEIVED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'POT_COMPLETED'
  | 'POT_CANCELED'

export interface AppNotification {
  id: number
  recipientId: string
  type: NotificationType
  potId: string | null
  participationId: string | null
  title: string
  body: string
  actionPath: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}
