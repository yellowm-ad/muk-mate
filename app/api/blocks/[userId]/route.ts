import { NextResponse } from 'next/server'

import { getSessionUserOrNull, unblockUser } from '@/lib/server-data'

export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { userId } = await params
  await unblockUser(me.id, userId)
  return NextResponse.json({ ok: true })
}
