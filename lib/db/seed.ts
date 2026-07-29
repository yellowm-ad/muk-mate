// 먹메이트(MukMate) 초기 시드 스크립트
//
// Neon 프로젝트가 생성되고 DATABASE_URL(pooled connection string)이 준비된 뒤,
// 마이그레이션을 DB에 적용한 다음(`pnpm db:push` 또는 마이그레이터 실행) 한 번 실행한다.
//   pnpm db:seed
//
// 지금은 DATABASE_URL이 없어 이 스크립트를 실행하지 않는다 (lib/db/index.ts가
// 쿼리 시점에 명확한 에러를 던진다). 코드만 미리 준비해 둔다.
//
// - zones: PRD 17-1 제안안 4개 권역 (구정문/신정문/기숙사/사대부고 주변)
// - chat_rooms: PRD 17-2 제안안 커뮤니티 고정방 2개 (type=COMMUNITY, pot_id=NULL)
//
// 여러 번 실행해도 안전하도록 (idempotent) onConflictDoNothing을 사용한다.

import { eq } from 'drizzle-orm'

import { db } from './index'
import { chatRooms, zones } from './schema'

const ZONE_SEED: Array<{ code: string; label: string; sortOrder: number }> = [
  { code: 'GUJEONGMUN', label: '구정문 권역', sortOrder: 0 },
  { code: 'SINJEONGMUN', label: '신정문 권역', sortOrder: 1 },
  { code: 'DORM', label: '기숙사 권역', sortOrder: 2 },
  { code: 'SADAEBUGO', label: '사대부고 주변 권역', sortOrder: 3 },
]

const COMMUNITY_ROOM_SEED: Array<{ title: string }> = [
  { title: '오늘 뭐 먹지 · 맛집 추천' },
  { title: '같이 먹어요 · 음식 여행' },
]

async function seed() {
  console.log('[seed] zones 시딩 중...')
  await db.insert(zones).values(ZONE_SEED).onConflictDoNothing({ target: zones.code })

  console.log('[seed] 커뮤니티 고정 채팅방 시딩 중...')
  for (const room of COMMUNITY_ROOM_SEED) {
    // chat_rooms.pot_id는 NULL 허용 UNIQUE라 여러 NULL이 충돌하지 않으므로
    // onConflictDoNothing으로는 중복 방지가 안 된다. title 존재 여부로 직접 확인한다.
    const existing = await db
      .select({ id: chatRooms.id })
      .from(chatRooms)
      .where(eq(chatRooms.title, room.title))
      .limit(1)

    if (existing.length > 0) {
      console.log(`[seed] 이미 존재함, 건너뜀: ${room.title}`)
      continue
    }

    await db.insert(chatRooms).values({
      type: 'COMMUNITY',
      potId: null,
      title: room.title,
    })
  }

  console.log('[seed] 완료')
}

seed()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('[seed] 실패:', err)
    process.exit(1)
  })
