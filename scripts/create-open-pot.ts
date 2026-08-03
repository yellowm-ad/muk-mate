import { getDb } from '../lib/db'
import { pots, users } from '../lib/db/schema'

async function main() {
  const db = getDb()
  const [host] = await db.select({ id: users.id }).from(users).limit(1)
  if (!host) throw new Error('No user in DB')

  const now = new Date()
  const deadline = new Date(now.getTime() + 10 * 60 * 60 * 1000) // 10 hours from now
  const pickup = new Date(now.getTime() + 11 * 60 * 60 * 1000)

  const [inserted] = await db
    .insert(pots)
    .values({
      hostId: host.id,
      zoneCode: 'GUJEONGMUN',
      storeName: '황금올리브 치킨 전북대점',
      storeAddress: '전북 전주시 덕진구 명륜4길 10',
      orderSummary: '황금올리브 1마리 같이 주문해요!',
      targetType: 'HEADCOUNT',
      targetValue: 4,
      deliveryFee: 3000,
      deadlineAt: deadline,
      pickupAt: pickup,
      pickupName: '전북대학교 구정문 앞',
      pickupAddress: '전북 전주시 덕진구 권삼득로 297',
      pickupNote: '시계탑 앞 부스',
      extraNote: '음료 추가 희망하시는 분 메모 남겨주세요!',
      status: 'OPEN',
    })
    .returning()

  console.log('CREATED_POT_ID:', inserted.id)
}

main().then(() => process.exit(0))
