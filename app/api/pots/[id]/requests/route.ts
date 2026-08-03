import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { participations, pots, users } from '@/lib/db/schema'
import { getSessionUserOrNull } from '@/lib/server-data'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id: potId } = await params
  const db = getDb()

  const [pot] = await db
    .select({ hostId: pots.hostId })
    .from(pots)
    .where(eq(pots.id, potId))
    .limit(1)

  if (!pot) {
    return NextResponse.json({ code: 'POT_NOT_FOUND', error: '존재하지 않는 모집글입니다.' }, { status: 404 })
  }

  if (pot.hostId !== me.id) {
    return NextResponse.json({ code: 'NOT_HOST', error: '방장만 신청 목록을 조회할 수 있습니다.' }, { status: 403 })
  }

  const rows = await db
    .select({
      userId: participations.userId,
      nickname: users.nickname,
      applyMessage: participations.applyMessage,
      requestedAt: participations.createdAt,
    })
    .from(participations)
    .innerJoin(users, eq(participations.userId, users.id))
    .where(
      and(
        eq(participations.potId, potId),
        eq(participations.approvalStatus, 'PENDING'),
      ),
    )
    .orderBy(desc(participations.createdAt))

  return NextResponse.json({
    items: rows.map((r) => ({
      userId: r.userId,
      nickname: r.nickname,
      menuMemo: r.applyMessage ?? '',
      requestedAt: r.requestedAt.toISOString(),
    })),
  })
}
