// DB 클라이언트 — PRD §10-3② 요구사항에 맞춰 @neondatabase/serverless HTTP 드라이버 사용.
// (pooled connection string 방식 대신 HTTP 드라이버를 쓰면 서버리스 환경에서 커넥션 고갈 문제 자체가 없다.)
//
// 지연 초기화(lazy)가 필요한 이유: DATABASE_URL이 없어도 `next build`/`next dev`는 정상 동작해야 하고,
// 실제로 쿼리를 실행하는 요청이 들어올 때만 에러가 나야 한다.
//
// 주의: 이 지연 초기화를 JS Proxy로 구현하면 안 된다 (vercel-storage 스킬 경고).
// `obj.method()` 형태 호출에서 Proxy의 get 트랩이 반환한 함수를 호출할 때 `this`가
// 실제 drizzle 인스턴스가 아니라 빈 Proxy 타겟에 바인딩되어, drizzle 내부가 `this`로
// 접근하는 private 필드를 못 찾고 조용히 멈추는 문제가 있다 (특히 Auth.js 연동 시 발견 사례多).
// 그래서 평범한 lazy 함수(getDb())로 구현한다 — 호출부는 `db.select(...)`가 아니라
// `getDb().select(...)`로 매번 실제 인스턴스를 받아써야 한다.
import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'

import * as schema from './schema'

function createDb(): NeonHttpDatabase<typeof schema> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL이 설정되지 않았습니다. .env.example을 참고해 .env.local에 Neon connection string을 넣어주세요.',
    )
  }
  const sql = neon(process.env.DATABASE_URL)
  return drizzle(sql, { schema })
}

let _db: NeonHttpDatabase<typeof schema> | undefined

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) _db = createDb()
  return _db
}

/**
 * Postgres 에러 코드(SQLSTATE) 확인 헬퍼.
 * drizzle-orm의 neon-http 드라이버는 실제 Postgres 에러를 DrizzleQueryError로 한 번
 * 감싸기 때문에 `.code`가 최상위가 아니라 `err.cause.code`에 들어있다 — 이 위치를
 * 몰라서 `err.code`만 확인하면 유니크 제약 위반(23505) 같은 걸 못 잡고 그대로
 * 500으로 새 나간다. 두 위치를 다 확인해서 드라이버 버전 차이에도 방어한다.
 */
export function getPgErrorCode(err: unknown): string | undefined {
  const direct = (err as { code?: string } | undefined)?.code
  if (direct) return direct
  return (err as { cause?: { code?: string } } | undefined)?.cause?.code
}
