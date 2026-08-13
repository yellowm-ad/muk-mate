import { NextResponse } from 'next/server'

import { blockUser, getSessionUserOrNull, listBlockedUsers } from '@/lib/server-data'

export async function GET() {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const blocked = await listBlockedUsers(me.id)
  return NextResponse.json({ blocked })
}

export async function POST(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : ''
  if (!targetUserId || targetUserId === me.id) {
    return NextResponse.json({ code: 'INVALID_INPUT', error: '대상을 확인해 주세요.' }, { status: 400 })
  }

  await blockUser(me.id, targetUserId)
  return NextResponse.json({ ok: true })
}
