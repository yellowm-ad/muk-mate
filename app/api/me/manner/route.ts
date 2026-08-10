import { NextResponse } from 'next/server'

import { getMannerProfile, getSessionUserOrNull } from '@/lib/server-data'

/** 내 매너 포만도와 단계 조회 (§17-5) */
export async function GET() {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const manner = await getMannerProfile(me.id)
  return NextResponse.json({ manner })
}
