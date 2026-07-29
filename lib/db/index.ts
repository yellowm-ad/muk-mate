// 먹메이트(MukMate) DB 클라이언트
//
// 서버리스 환경(Vercel)에서는 커넥션이 요청마다 새로 뜨기 때문에 일반 pg 드라이버로
// direct connection을 맺으면 커넥션이 급격히 늘어나 배포 후 커넥션 고갈로 500 에러가 난다
// (PRD 10-3②). 반드시 `@neondatabase/serverless`의 HTTP 기반 드라이버를 사용하고,
// Neon 프로젝트의 **pooled connection string**(PgBouncer 경유)을 DATABASE_URL로 받는다.
//
// 이 파일은 Route Handler / Server Action 등 서버 코드에서만 import한다.
// 클라이언트 번들에 절대 포함되면 안 된다 (DB 연결 문자열 노출 금지, CLAUDE.md 절대 원칙).

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import * as schema from './schema'

// DATABASE_URL이 아직 없는 개발 초기 단계(Neon 프로젝트 미생성)에서도 앱 전체가
// import 시점에 빌드/구동 실패하지 않도록, 클라이언트 생성을 지연시킨다.
// 실제로 DB에 쿼리를 날리는 시점에만 값이 필요하며, 그때 없으면 명확한 에러를 던진다.
function createDb() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    // 개발 중 (Neon 프로젝트를 아직 만들지 않은 경우) 이 경로로 들어오면
    // 원인을 바로 알 수 있도록 명시적인 에러 메시지를 던진다.
    const sql = (() => {
      throw new Error(
        'DATABASE_URL이 설정되어 있지 않습니다. Neon pooled connection string을 ' +
          '.env.local(로컬) 또는 Vercel 환경변수(Production/Preview/Development)에 등록하세요.',
      )
    }) as unknown as ReturnType<typeof neon>

    return drizzle(sql, { schema })
  }

  const sql = neon(connectionString)
  return drizzle(sql, { schema })
}

export const db = createDb()

export { schema }
