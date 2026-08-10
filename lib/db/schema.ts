// Drizzle 스키마 — docs/PRD.md §11-2 DDL과 1:1 대응.
// 컬럼을 바꾸려면 PRD §11-2와 .claude/skills/mukmate-db-schema/SKILL.md도 함께 갱신할 것.

import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const potStatusEnum = pgEnum('pot_status', ['OPEN', 'CLOSED', 'ORDERED', 'CANCELED'])
export const approvalEnum = pgEnum('approval', ['PENDING', 'APPROVED', 'REJECTED'])
export const roomTypeEnum = pgEnum('room_type', ['ORDER', 'COMMUNITY'])
export const messageTypeEnum = pgEnum('message_type', ['TEXT', 'SYSTEM'])
export const targetTypeEnum = pgEnum('target_type', ['HEADCOUNT', 'AMOUNT'])
export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'SUSPENDED', 'DISABLED'])
export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN'])
export const reportReasonEnum = pgEnum('report_reason', [
  'HARASSMENT',
  'SEXUAL_CONTENT',
  'SPAM',
  'FRAUD',
  'NO_SHOW',
  'PRIVACY',
  'UNSAFE_MEETING',
  'OTHER',
])
export const reportStatusEnum = pgEnum('report_status', ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'])
export const notificationTypeEnum = pgEnum('notification_type', [
  'APPLICATION_SUBMITTED',
  'APPLICATION_RECEIVED',
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
  'POT_COMPLETED',
  'POT_CANCELED',
])
export const mannerRatingEnum = pgEnum('manner_rating', ['GOOD', 'NEUTRAL', 'BAD'])

/** 활동 지역: 목록이 아직 미확정(PRD §17-1)이라 enum이 아니라 테이블로 분리 */
export const zones = pgTable('zones', {
  code: text('code').primaryKey(), // 'GUJEONGMUN' | 'SINJEONGMUN' | 'DORM' | 'SADAEBUGO' — lib/constants.ts와 반드시 일치
  label: text('label').notNull(),
  sortOrder: smallint('sort_order').notNull().default(0),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  loginId: text('login_id').notNull().unique(), // 외부에 노출하지 않음 — 표시는 nickname만
  passwordHash: text('password_hash').notNull(), // bcrypt 해시, 평문 저장 금지
  nickname: text('nickname').notNull(),
  zoneCode: text('zone_code')
    .notNull()
    .references(() => zones.code), // PRD §5-3: 활동 지역은 회원가입 필수 정보
  accountStatus: accountStatusEnum('account_status').notNull().default('ACTIVE'),
  role: userRoleEnum('role').notNull().default('USER'), // 관리자 권한 검증 전용 — 셀프서비스로 바꿀 수 없음(DB에서 직접 부여)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pots = pgTable(
  'pots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id),
    zoneCode: text('zone_code')
      .notNull()
      .references(() => zones.code),

    // 가게 (카카오 로컬 API 결과)
    storeName: text('store_name').notNull(),
    storeAddress: text('store_address'),
    storeLat: numeric('store_lat', { precision: 10, scale: 7 }),
    storeLng: numeric('store_lng', { precision: 10, scale: 7 }),

    orderSummary: text('order_summary').notNull(),
    targetType: targetTypeEnum('target_type').notNull(),
    targetValue: integer('target_value').notNull(), // 명 또는 원
    deliveryFee: integer('delivery_fee'), // P1 분담 계산용 (선택 입력)

    deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
    pickupAt: timestamp('pickup_at', { withTimezone: true }),

    // 수령 장소 (카카오 로컬 API 결과 + 직접 설명)
    pickupName: text('pickup_name').notNull(),
    pickupAddress: text('pickup_address'),
    pickupLat: numeric('pickup_lat', { precision: 10, scale: 7 }),
    pickupLng: numeric('pickup_lng', { precision: 10, scale: 7 }),
    pickupNote: text('pickup_note'),

    extraNote: text('extra_note'),
    status: potStatusEnum('status').notNull().default('OPEN'),
    // ORDERED로 바뀐 시각 — 매너평가 가능 기간(완료 후 7일, §17-5) 판정에 사용. ORDERED가 아니면 NULL.
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_pots_zone_status').on(table.zoneCode, table.status, table.deadlineAt)],
)

export const participations = pgTable(
  'participations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    potId: uuid('pot_id')
      .notNull()
      .references(() => pots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    applyMessage: text('apply_message'), // 참여 신청 시 짧은 메시지
    menuAmount: integer('menu_amount'), // P1: 분담 금액 계산용 (nullable)
    approvalStatus: approvalEnum('approval_status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('participations_pot_user_key').on(table.potId, table.userId), // 중복 신청 방지
    index('idx_participations_user').on(table.userId, table.createdAt),
    // 방장의 "대기 중 신청 목록" 조회(GET /api/pots/:id/requests) 전용 부분 인덱스
    index('idx_participations_pending')
      .on(table.potId, table.createdAt)
      .where(sql`${table.approvalStatus} = 'PENDING'`),
  ],
)

export const chatRooms = pgTable('chat_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: roomTypeEnum('type').notNull(),
  potId: uuid('pot_id')
    .unique()
    .references(() => pots.id, { onDelete: 'cascade' }), // ORDER일 때만
  title: text('title').notNull(), // COMMUNITY 고정방 이름
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const messages = pgTable(
  'messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(), // 폴링 커서로 사용
    roomId: uuid('room_id')
      .notNull()
      .references(() => chatRooms.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => users.id), // SYSTEM 메시지는 NULL
    type: messageTypeEnum('type').notNull().default('TEXT'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_messages_room').on(table.roomId, table.id)],
)

// 읽음 표시(v2.5) — 주문 채팅방(ORDER) 한정. 커뮤니티 채팅방은 참여자 개념이 없어 대상에서 제외.
// 참여자별로 "이 방에서 마지막으로 읽은 메시지 id"만 저장하고, 메시지별 안읽은 인원수는
// 클라이언트가 messages.id와 비교해 계산한다(카카오톡 그룹채팅 방식).
export const roomReads = pgTable(
  'room_reads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => chatRooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    lastReadMessageId: bigint('last_read_message_id', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('room_reads_room_user_key').on(table.roomId, table.userId)],
)

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    reportedUserId: uuid('reported_user_id')
      .notNull()
      .references(() => users.id),
    roomId: uuid('room_id').references(() => chatRooms.id, { onDelete: 'set null' }),
    messageId: bigint('message_id', { mode: 'number' }).references(() => messages.id, { onDelete: 'set null' }),
    reason: reportReasonEnum('reason').notNull(),
    detail: text('detail'),
    messageContentSnapshot: text('message_content_snapshot'),
    messageCreatedSnapshot: timestamp('message_created_snapshot', { withTimezone: true }),
    status: reportStatusEnum('status').notNull().default('PENDING'),
    adminNote: text('admin_note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_reports_status_created').on(table.status, table.createdAt),
    uniqueIndex('idx_reports_duplicate_message').on(table.reporterId, table.messageId),
  ],
)

export const notifications = pgTable(
  'notifications',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    potId: uuid('pot_id').references(() => pots.id, { onDelete: 'cascade' }),
    participationId: uuid('participation_id').references(() => participations.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    actionPath: text('action_path'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    dedupeKey: text('dedupe_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_recipient_created').on(table.recipientId, table.createdAt),
    index('idx_notifications_recipient_unread').on(table.recipientId, table.isRead, table.createdAt),
  ],
)

// 매너 포만도(PRD §17-5) — 사용자별 현재 점수·평가 수. 단계(getMannerStage)는 점수로 계산하므로 여기 저장하지 않는다.
export const mannerProfiles = pgTable(
  'manner_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    score: numeric('score', { precision: 5, scale: 2 }).notNull().default('50'),
    reviewCount: integer('review_count').notNull().default(0),
    positiveCount: integer('positive_count').notNull().default(0),
    negativeCount: integer('negative_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('manner_profiles_score_range', sql`${table.score} >= 0 AND ${table.score} <= 100`)],
)

// 매너평가 1건. 호스트↔승인 참여자 관계에서만 작성 가능(참여자끼리는 대상 아님, §17-5).
// visibleAfter: 최초 평가 후 48시간 — 상대 평가가 없어도 이 시각이 지나면 반영 대상이 된다.
// appliedAt: 점수에 실제로 반영된 시각. NULL이면 아직 manner_profiles에 델타가 적용되지 않은 상태.
export const mannerReviews = pgTable(
  'manner_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    potId: uuid('pot_id')
      .notNull()
      .references(() => pots.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id),
    revieweeId: uuid('reviewee_id')
      .notNull()
      .references(() => users.id),
    rating: mannerRatingEnum('rating').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    visibleAfter: timestamp('visible_after', { withTimezone: true }).notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 같은 주문에서 같은 상대를 중복 평가하는 것을 방지 (§17-5)
    uniqueIndex('manner_reviews_pot_reviewer_reviewee_key').on(table.potId, table.reviewerId, table.revieweeId),
    index('idx_manner_reviews_reviewee').on(table.revieweeId, table.createdAt),
    check('manner_reviews_no_self_review', sql`${table.reviewerId} <> ${table.revieweeId}`),
  ],
)

// 점수 변경 이력. 일반 평가 반영과 관리자 제재를 reasonCode로 구분해서 기록한다(§17-5).
export const mannerEvents = pgTable('manner_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reviewId: uuid('review_id').references(() => mannerReviews.id, { onDelete: 'set null' }),
  reasonCode: text('reason_code').notNull(),
  delta: numeric('delta', { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// re-export for callers that want a raw sql tag without importing drizzle-orm directly
export { sql }
