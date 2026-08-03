import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getAdminOrNull } from '@/lib/admin/auth'
import { getDb } from '@/lib/db'
import { reports } from '@/lib/db/schema'

const STATUS_SET = new Set(['REVIEWING', 'RESOLVED', 'DISMISSED'])
const NOTE_MAX = 500

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminOrNull()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = typeof body?.status === 'string' ? body.status : ''
  const adminNote = typeof body?.adminNote === 'string' ? body.adminNote.trim() : undefined

  if (!STATUS_SET.has(status)) {
    return NextResponse.json({ error: '올바른 상태 값을 선택해 주세요.' }, { status: 400 })
  }
  if (adminNote && adminNote.length > NOTE_MAX) {
    return NextResponse.json({ error: '메모가 너무 깁니다.' }, { status: 400 })
  }

  const db = getDb()
  const [existing] = await db.select({ id: reports.id }).from(reports).where(eq(reports.id, id)).limit(1)
  if (!existing) {
    return NextResponse.json({ error: '존재하지 않는 신고입니다.' }, { status: 404 })
  }

  const [updated] = await db
    .update(reports)
    .set({
      status: status as never,
      adminNote: adminNote ?? undefined,
      reviewedAt: new Date(),
    })
    .where(eq(reports.id, id))
    .returning()

  return NextResponse.json({
    report: {
      id: updated.id,
      status: updated.status,
      adminNote: updated.adminNote,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    },
  })
}
