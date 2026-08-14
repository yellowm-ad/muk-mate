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
export const roomTypeEnum = pgEnum('room_type', ['ORDER', 'COMMUNITY', 'DM'])
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
  'FRIEND_REQUEST_RECEIVED',
  'FRIEND_REQUEST_ACCEPTED',
  'POT_INVITED',
])
export const mannerRatingEnum = pgEnum('manner_rating', ['GOOD', 'NEUTRAL', 'BAD'])
export const friendRequestStatusEnum = pgEnum('friend_request_status', ['PENDING', 'ACCEPTED'])

/** 활동 지역: 목록이 아직 미확정(PRD §17-1)이라 enum이 아니라 테이블로 분리 */
export const zones = pgTable('zones', {
  code: text('code').primaryKey(), // 'GUJEONGMUN' | 'SINJEONGMUN' | 'DORM' | 'SADAEBUGO' — lib/constants.ts와 반드시 일치
  label: text('label').notNull(),
  sortOrder: smallint('sort_order').notNull().default(0),
})

export const users = pgTable(
  'users',
  {
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
    // 전북대 이메일 인증(신규, 2026-08-14 CLAUDE.md 참고) — 기존 계정은 NULL로 남고 신규 가입자만 채워진다.
    // 관리자 화면에서만 노출하고, 본인은 마이페이지 기본정보 수정에서만 확인 가능 — 다른 사용자에게는 절대 노출 금지.
    jbnuEmail: text('jbnu_email'),
    jbnuEmailVerifiedAt: timestamp('jbnu_email_verified_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('users_jbnu_email_key').on(table.jbnuEmail)],
)

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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // ORDERED로 전이된 시각 — 매너평가 "완료 후 7일 이내" 판정 기준점(§7). ORDERED 이전에는 null.
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
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
    // 거래 완료 확인(신규) — 호스트 포함 승인 참여자 전원이 각자 확인해야 CLOSED→ORDERED로 전이된다.
    // 방장도 모집글 생성 시 APPROVED 참여자 행을 함께 가지므로 별도 컬럼 없이 여기서 같이 추적한다.
    completedAt: timestamp('completed_at', { withTimezone: true }),
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

export const chatRooms = pgTable(
  'chat_rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: roomTypeEnum('type').notNull(),
    potId: uuid('pot_id')
      .unique()
      .references(() => pots.id, { onDelete: 'cascade' }), // ORDER일 때만
    title: text('title').notNull(), // COMMUNITY 고정방 이름. DM은 조회 시점에 상대방 닉네임으로 덮어써서 보여준다.
    // 친구 DM(신규) 전용 — 두 유저 id를 항상 문자열 오름차순(작은 값이 A)으로 저장해 같은 쌍에 대해
    // 방이 중복 생성되지 않도록 한다(unique index). ORDER/COMMUNITY는 둘 다 NULL.
    dmUserAId: uuid('dm_user_a_id').references(() => users.id),
    dmUserBId: uuid('dm_user_b_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('chat_rooms_dm_pair_key').on(table.dmUserAId, table.dmUserBId)],
)

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
    // 채팅 삭제(카카오톡 스타일) — 보낸 사람 본인이 5분 이내에 지우면 전체 삭제(모두에게 "메시지가
    // 삭제되었습니다"로 표시). content는 신고 스냅샷 등과의 정합성을 위해 지우지 않고 남겨두고,
    // 화면에서는 deletedAt이 있으면 항상 content 대신 삭제 문구를 보여준다.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_messages_room').on(table.roomId, table.id)],
)

// 5분이 지났거나 남의 메시지라 전체 삭제할 수 없을 때 쓰는 "나만 안 보이게 삭제" — 이 표에 행이
// 있으면 해당 유저의 목록 조회에서만 그 메시지를 제외한다(다른 참여자에게는 원본 그대로 보인다).
export const messageHides = pgTable(
  'message_hides',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    messageId: bigint('message_id', { mode: 'number' })
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('message_hides_message_user_key').on(table.messageId, table.userId)],
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

// 친구(신규) — 같은 공동주문에 함께 참여했던 사람끼리만 신청 가능(서버에서 검증, §친구 기능).
// 수락 전에는 PENDING 한 행만 존재하고, 수락하면 그 행 자체가 ACCEPTED로 바뀐다(친구=ACCEPTED 행
// 존재로 판정, 방향 무관하게 requesterId/addresseeId 양쪽에서 조회). 거절하면 행을 그냥 지운다 —
// 나중에 다시 신청할 수 있어야 하기 때문(REJECTED 상태를 영구히 남기지 않음).
export const friendRequests = pgTable(
  'friend_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendRequestStatusEnum('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('friend_requests_pair_key').on(table.requesterId, table.addresseeId),
    index('idx_friend_requests_addressee_status').on(table.addresseeId, table.status),
  ],
)

// 차단(신규) — 방향성 있음(blockerId가 blockedId를 차단). 차단당한 쪽만 상대에게 메시지를 보낼 수
// 없다(§친구 기능 — 다시 집적거리지 못하게 막는 게 목적). 차단하면 서버가 기존 친구 관계도 함께 끊는다.
export const userBlocks = pgTable(
  'user_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_blocks_pair_key').on(table.blockerId, table.blockedId)],
)

// 사용자 환경설정(신규) — 1:1 확장 테이블(manner_profiles와 같은 패턴). 행이 없으면 전부 기본값으로
// 취급한다 — 설정을 실제로 바꾼 사용자만 upsert로 행이 생긴다.
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  potNotificationsEnabled: boolean('pot_notifications_enabled').notNull().default(true),
  friendNotificationsEnabled: boolean('friend_notifications_enabled').notNull().default(true),
  autoAcceptFriendRequests: boolean('auto_accept_friend_requests').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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

// 매너 포만도(P0) — docs/PRD.md 범위 밖의 별도 기획안(매너 포만도 및 성장형 아바타 §14)에서 가져온 스키마.
// 점수 계산·반영은 서버 전용(lib/server-data.ts) — 클라이언트가 변화량을 직접 보내지 않는다.
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
    // v2.9(P1): 아바타 커스터마이징. 매너 단계별 표정·자세는 여전히 서버가 stage로만 결정하고
    // 바꿀 수 없다 — 여기 저장하는 건 사용자가 고를 수 있는 색상·소품 "키"뿐(이미지 URL 아님).
    avatarColor: text('avatar_color').notNull().default('NAVY'),
    avatarAccessory: text('avatar_accessory').notNull().default('NONE'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('manner_profiles_score_check', sql`${table.score} >= 0 AND ${table.score} <= 100`)],
)

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
    // 반영 시점: 상대방도 제출했거나 이 시각이 지나면(48시간) 다음 조회 시점에 lazy 적용 — 크론 없음(§10-3③).
    visibleAfter: timestamp('visible_after', { withTimezone: true }).notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('manner_reviews_pot_reviewer_reviewee_key').on(table.potId, table.reviewerId, table.revieweeId),
    index('idx_manner_reviews_reviewee').on(table.revieweeId, table.appliedAt),
    check('manner_reviews_no_self_review_check', sql`${table.reviewerId} <> ${table.revieweeId}`),
  ],
)

export const mannerEvents = pgTable('manner_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  reviewId: uuid('review_id').references(() => mannerReviews.id),
  reasonCode: text('reason_code').notNull(), // P0: 'PEER_REVIEW' 고정 — 관리자 제재 사유 코드는 P1
  delta: numeric('delta', { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// 전북대 이메일 인증(신규) — 발급된 인증번호 이력. rate limit도 이 테이블에서 직접 카운트한다(별도 인프라 없음).
// purpose로 용도를 구분해, 한 목적으로 받은 코드가 다른 목적(예: 회원가입 코드로 비밀번호 변경)에
// 재사용되지 않도록 막는다 — lib/email-verification.ts가 검증할 때 항상 purpose까지 같이 필터링한다.
export const emailVerificationPurposeEnum = pgEnum('email_verification_purpose', [
  'SIGNUP',
  'FIND_ID',
  'RESET_PASSWORD',
  'CHANGE_LOGIN_ID',
])

export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(), // 소문자로 정규화해 저장
    purpose: emailVerificationPurposeEnum('purpose').notNull().default('SIGNUP'),
    codeHash: text('code_hash').notNull(), // bcrypt 해시 — 비밀번호와 동일하게 평문 저장 금지
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }), // 실제로 쓰인(가입 완료·비밀번호 변경 등) 시점
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_email_verifications_email_created').on(table.email, table.createdAt)],
)

// re-export for callers that want a raw sql tag without importing drizzle-orm directly
export { sql }
