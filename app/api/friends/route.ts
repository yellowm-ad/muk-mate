import { NextResponse } from 'next/server'

import { getSessionUserOrNull, listFriends, sendFriendRequest } from '@/lib/server-data'

export async function GET() {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const friends = await listFriends(me.id)
  return NextResponse.json({ friends })
}

export async function POST(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : ''
  if (!targetUserId) {
    return NextResponse.json({ code: 'INVALID_INPUT', error: '대상을 확인해 주세요.' }, { status: 400 })
  }

  const result = await sendFriendRequest(me.id, targetUserId)
  if (!result.ok) {
    const status = result.code === 'NOT_ELIGIBLE' || result.code === 'BLOCKED' ? 403 : 409
    return NextResponse.json({ code: result.code, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, status: result.status }, { status: 201 })
}
