// 초기 시드 — 활동 지역 4권역(PRD §17-1) + 커뮤니티 고정 채팅방 2개(§17-2).
// 실행: npm run db:seed  (dotenv-cli가 .env.local을 미리 로드해서 실행함 — package.json 참고)
import { getDb } from '../lib/db'
import { chatRooms, zones } from '../lib/db/schema'

const ZONES = [
  { code: 'GUJEONGMUN', label: '구정문 권역', sortOrder: 0 },
  { code: 'SINJEONGMUN', label: '신정문 권역', sortOrder: 1 },
  { code: 'DORM', label: '기숙사 권역', sortOrder: 2 },
  { code: 'SADAEBUGO', label: '사대부고 주변 권역', sortOrder: 3 },
] as const

const COMMUNITY_ROOMS = [
  { type: 'COMMUNITY' as const, title: '오늘 뭐 먹지 · 맛집 추천' },
  { type: 'COMMUNITY' as const, title: '같이 먹어요 · 음식 여행' },
]

async function main() {
  const db = getDb()
  await db.insert(zones).values([...ZONES]).onConflictDoNothing()
  await db.insert(chatRooms).values(COMMUNITY_ROOMS).onConflictDoNothing()
  console.log('시드 완료: zones 4건 + community chat_rooms 2건')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
