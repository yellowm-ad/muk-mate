import { NextResponse } from 'next/server'

import { getMannerProfile, getSessionUserOrNull } from '@/lib/server-data'

/** 다른 사용자의 공개 매너 정보 조회 (§17-5, 로그인 필요) */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const manner = await getMannerProfile(id)
  return NextResponse.json({ manner })
}
