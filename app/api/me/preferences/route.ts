import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { userPreferences } from '@/lib/db/schema'
import { getSessionUserOrNull } from '@/lib/server-data'

const DEFAULTS = {
  potNotificationsEnabled: true,
  friendNotificationsEnabled: true,
  autoAcceptFriendRequests: false,
}

export async function GET() {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const [row] = await getDb().select().from(userPreferences).where(eq(userPreferences.userId, me.id)).limit(1)

  return NextResponse.json({
    potNotificationsEnabled: row?.potNotificationsEnabled ?? DEFAULTS.potNotificationsEnabled,
    friendNotificationsEnabled: row?.friendNotificationsEnabled ?? DEFAULTS.friendNotificationsEnabled,
    autoAcceptFriendRequests: row?.autoAcceptFriendRequests ?? DEFAULTS.autoAcceptFriendRequests,
  })
}

export async function PATCH(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const patch: Partial<typeof DEFAULTS> = {}
  if (typeof body?.potNotificationsEnabled === 'boolean') patch.potNotificationsEnabled = body.potNotificationsEnabled
  if (typeof body?.friendNotificationsEnabled === 'boolean')
    patch.friendNotificationsEnabled = body.friendNotificationsEnabled
  if (typeof body?.autoAcceptFriendRequests === 'boolean') patch.autoAcceptFriendRequests = body.autoAcceptFriendRequests

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 })
  }

  const db = getDb()
  await db
    .insert(userPreferences)
    .values({ userId: me.id, ...DEFAULTS, ...patch })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { ...patch, updatedAt: new Date() } })

  return NextResponse.json({ ok: true })
}
