import { NextResponse } from 'next/server'

import { confirmPotCompletion, getSessionUserOrNull } from '@/lib/server-data'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id: potId } = await params
  const result = await confirmPotCompletion(potId, me.id)
  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'NOT_A_MEMBER' ? 403 : 409
    return NextResponse.json({ code: result.code, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, allConfirmed: result.allConfirmed, done: result.done, total: result.total })
}
