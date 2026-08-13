import { NextResponse } from 'next/server'

import { getOrCreateDmRoom, getSessionUserOrNull } from '@/lib/server-data'

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

  const result = await getOrCreateDmRoom(me.id, targetUserId)
  if (!result.ok) {
    return NextResponse.json({ code: result.code, error: result.error }, { status: 403 })
  }

  return NextResponse.json({ roomId: result.roomId })
}
