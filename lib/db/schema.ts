// 먹메이트(MukMate) DB 스키마 — Drizzle ORM
//
// docs/PRD.md 11-2절 Postgres 스키마를 Drizzle 테이블 정의로 그대로 옮긴 것이다.
// 컬럼/enum/인덱스를 추가하거나 생략하지 않는다 (특히 계좌 등 금융정보 컬럼은 절대 추가하지 않는다).
// 금액은 전부 integer(원), 시간은 전부 timestamptz. messages.id는 폴링 커서로 쓰기 위해 bigserial.

import { sql } from 'drizzle-orm'
import {
  bigserial,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// ── enum 5종 ──────────────────────────────────────────────────────────────

export const potStatusEnum = pgEnum('pot_status', ['OPEN', 'CLOSED', 'ORDERED', 'CANCELED'])
export const approvalEnum = pgEnum('approval', ['PENDING', 'APPROVED', 'REJECTED'])
export const roomTypeEnum = pgEnum('room_type', ['ORDER', 'COMMUNITY'])
export const messageTypeEnum = pgEnum('message_type', ['TEXT', 'SYSTEM'])
export const targetTypeEnum = pgEnum('target_type', ['HEADCOUNT', 'AMOUNT'])

// ── zones: 활동 지역 코드 테이블 (PRD 17-1) ─────────────────────────────────

export const zones = pgTable('zones', {
  code: text('code').primaryKey(), // 'GUJEONGMUN', 'DORM' ...
  label: text('label').notNull(), // '구정문 권역'
  sortOrder: smallint('sort_order').notNull().default(0),
})

// ── users ────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  loginId: text('login_id').notNull().unique(), // 아이디 (외부에 노출하지 않음)
  passwordHash: text('password_hash').notNull(), // 평문 저장 금지
  nickname: text('nickname').notNull(), // 타인에게 보이는 이름
  zoneCode: text('zone_code').references(() => zones.code), // 활동 지역
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── pots ─────────────────────────────────────────────────────────────────

export const pots = pgTable(
  'pots',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id),
    zoneCode: text('zone_code')
      .notNull()
      .references(() => zones.code),

    // 가게 (네이버 지역 검색 API 결과)
    storeName: text('store_name').notNull(),
    storeAddress: text('store_address'),
    storeLat: numeric('store_lat', { precision: 10, scale: 7 }),
    storeLng: numeric('store_lng', { precision: 10, scale: 7 }),

    orderSummary: text('order_summary').notNull(), // 음식 종류 / 주문 내용
    targetType: targetTypeEnum('target_type').notNull(), // 인원 목표 또는 금액 목표
    targetValue: integer('target_value').notNull(), // 명 또는 원
    deliveryFee: integer('delivery_fee'), // P1 분담 계산용 (선택 입력)

    deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(), // 모집 마감 시각
    pickupAt: timestamp('pickup_at', { withTimezone: true }), // 주문/수령 예정 시각

    // 수령 장소 (네이버 지역 검색 API·NAVER Maps API 결과 + 직접 설명)
    pickupName: text('pickup_name').notNull(),
    pickupAddress: text('pickup_address'),
    pickupLat: numeric('pickup_lat', { precision: 10, scale: 7 }),
    pickupLng: numeric('pickup_lng', { precision: 10, scale: 7 }),
    pickupNote: text('pickup_note'),

    extraNote: text('extra_note'),
    status: potStatusEnum('status').notNull().default('OPEN'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_pots_zone_status').on(table.zoneCode, table.status, table.deadlineAt)],
)

// ── participations ───────────────────────────────────────────────────────

export const participations = pgTable(
  'participations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
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
    unique('participations_pot_id_user_id_unique').on(table.potId, table.userId), // 중복 신청 방지
    index('idx_participations_user').on(table.userId, table.createdAt.desc()),
  ],
)

// ── chat_rooms ───────────────────────────────────────────────────────────

export const chatRooms = pgTable('chat_rooms', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  type: roomTypeEnum('type').notNull(),
  potId: uuid('pot_id')
    .unique()
    .references(() => pots.id, { onDelete: 'cascade' }), // ORDER일 때만
  title: text('title').notNull(), // COMMUNITY 고정방 이름
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── messages ─────────────────────────────────────────────────────────────

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
