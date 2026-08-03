import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { getSessionUserOrNull } from '@/lib/server-data'

export async function PATCH() {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const db = getDb()

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(eq(notifications.recipientId, me.id), eq(notifications.isRead, false)))

  return NextResponse.json({ ok: true })
}
