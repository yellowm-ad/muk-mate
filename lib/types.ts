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
  storeLat?: number
  storeLng?: number
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
  pickupLat?: number
  pickupLng?: number
  pickupNote: string
  extraNote: string
  status: PotStatus
  isLocationVerified: boolean
  /** 클라이언트에서 위치 권한을 허용했을 때만 채워진다(§9-3) — 서버는 항상 null을 내려준다 */
  distanceMeters: number | null
  viewerState?: ViewerState
  approvedCount?: number
  pendingCount?: number
  chatRoomId?: string
  createdAt: string
}

/** 참여자 목록 등에서 함께 노출하는 최소 매너 정보 — 점수는 안 준다(§4-1 개별 화면 비공개 원칙), 표정용 stage만 */
export interface MannerAvatarInfo {
  stage: MannerStage
  avatarColor: MannerAvatarColor
  avatarAccessory: MannerAvatarAccessory
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
  manner?: MannerAvatarInfo
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
  /** SYSTEM 메시지는 없음(senderId가 없으니까) */
  manner?: MannerAvatarInfo
  /** 전체 삭제(카카오톡 스타일) 시각 — 있으면 content 대신 "메시지가 삭제되었습니다"를 보여준다 */
  deletedAt?: string | null
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

export type MannerRating = 'GOOD' | 'NEUTRAL' | 'BAD'

/** 매너 포만도 5단계 + 신규 유저 상태(§5) — 낮은 순 → 높은 순 */
export type MannerStage = 'NEW' | 'STARVING' | 'PECKISH' | 'STEADY' | 'FULL' | 'HAPPY'

export type MannerAvatarColor = 'NAVY' | 'CORAL' | 'MINT' | 'BUTTER_YELLOW'
export type MannerAvatarAccessory = 'NONE' | 'GLASSES' | 'SCARF' | 'BAG' | 'HAT'

export interface MannerProfile {
  /** reviewCount < 3이면 점수는 비공개(§4-1) — null로 표현 */
  score: number | null
  stage: MannerStage
  reviewCount: number
  /** 많이 받은 긍정 태그 코드, 최대 3개 — score와 동일하게 reviewCount < 3이면 빈 배열 */
  topTags: string[]
  avatarColor: MannerAvatarColor
  avatarAccessory: MannerAvatarAccessory
}

export interface MannerReviewTarget {
  userId: string
  nickname: string
  alreadyReviewed: boolean
  /** §12-3: 평가 화면은 대상의 현재 매너 배지(닉네임과 아바타)를 함께 보여준다 */
  manner: MannerProfile
}

export interface MannerReviewStatus {
  eligible: boolean
  /** eligible이 false여도 이유 파악용으로 채워질 수 있음 */
  reason?: string
  targets: MannerReviewTarget[]
}

/** 거래 완료 확인(먹튀 방지) 현황 — 방장 포함 승인 참여자 전원이 확인해야 ORDERED로 전이된다 */
export interface PotCompletionStatus {
  total: number
  done: number
  allConfirmed: boolean
  viewerConfirmed: boolean
  viewerIsMember: boolean
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
