import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { getSessionUserOrNull } from '@/lib/server-data'

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id: idParam } = await params
  const notificationId = parseInt(idParam, 10)
  if (isNaN(notificationId)) {
    return NextResponse.json({ code: 'INVALID_ID', error: '유효하지 않은 알림 ID입니다.' }, { status: 400 })
  }

  const db = getDb()

  const [existing] = await db
    .select({
      id: notifications.id,
      recipientId: notifications.recipientId,
      isRead: notifications.isRead,
    })
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ code: 'NOT_FOUND', error: '존재하지 않는 알림입니다.' }, { status: 404 })
  }

  if (existing.recipientId !== me.id) {
    return NextResponse.json({ code: 'FORBIDDEN', error: '권한이 없습니다.' }, { status: 403 })
  }

  if (existing.isRead) {
    return NextResponse.json({ ok: true, isRead: true })
  }

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, me.id)))

  return NextResponse.json({ ok: true, isRead: true })
}
