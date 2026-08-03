import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getAdminOrNull } from '@/lib/admin/auth'
import { getDb } from '@/lib/db'
import { pots } from '@/lib/db/schema'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminOrNull()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  const { id } = await params
  const db = getDb()

  const [existing] = await db.select({ id: pots.id }).from(pots).where(eq(pots.id, id)).limit(1)
  if (!existing) {
    return NextResponse.json({ error: '존재하지 않는 모집글입니다.' }, { status: 404 })
  }

  // 참여자/방장 조건과 무관하게 즉시 삭제 — 참여·채팅방·알림은 스키마상 onDelete: cascade로 함께 정리됨
  await db.delete(pots).where(eq(pots.id, id))

  return NextResponse.json({ ok: true })
}
