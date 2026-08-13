import { NextResponse } from 'next/server'

import { getFriendshipContext, getSessionUserOrNull } from '@/lib/server-data'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const context = await getFriendshipContext(me.id, id)
  return NextResponse.json(context)
}
