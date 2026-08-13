import { NextResponse } from 'next/server'

import { getSessionUserOrNull, respondToFriendRequest } from '@/lib/server-data'

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { requestId } = await params
  const body = await request.json().catch(() => null)
  const action = body?.action === 'accept' || body?.action === 'reject' ? body.action : null
  if (!action) {
    return NextResponse.json({ code: 'INVALID_INPUT', error: '요청을 확인해 주세요.' }, { status: 400 })
  }

  const result = await respondToFriendRequest(requestId, me.id, action)
  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 409
    return NextResponse.json({ code: result.code, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
