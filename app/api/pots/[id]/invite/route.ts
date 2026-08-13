import { NextResponse } from 'next/server'

import { getSessionUserOrNull, invitePotFriends } from '@/lib/server-data'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const rawIds = Array.isArray(body?.friendUserIds) ? (body.friendUserIds as unknown[]) : []
  const friendUserIds = rawIds.filter((v): v is string => typeof v === 'string')

  const result = await invitePotFriends(id, me.id, friendUserIds)
  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : 403
    return NextResponse.json({ code: result.code, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, invitedCount: result.invitedCount })
}
