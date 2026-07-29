// Drizzle Kit 설정 — 마이그레이션 생성/적용 CLI가 참조한다.
//
// 주의: 이 파일은 `drizzle-kit generate`(로컬 스키마 → SQL 생성, DB 연결 불필요)와
// `drizzle-kit push`/`migrate`(실제 DB 반영, DATABASE_URL 필요) 양쪽에서 쓰인다.
// 아직 Neon 프로젝트가 없어 DATABASE_URL이 없는 동안에는 generate만 실행한다.

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dbCredentials: {
    // Neon pooled connection string (PRD 10-3②). push/migrate 실행 시점에만 필요.
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
})
