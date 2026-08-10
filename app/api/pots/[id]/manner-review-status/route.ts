import { NextResponse } from 'next/server'

import { getMannerReviewTargets, getSessionUserOrNull } from '@/lib/server-data'

/** 평가 가능 대상과 작성 여부 조회 (§17-5) — 주문 관계자(호스트/승인된 참여자)만 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const targets = await getMannerReviewTargets(id, me.id)
  return NextResponse.json({ targets })
}
