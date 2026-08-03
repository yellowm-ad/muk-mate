import { NextResponse } from 'next/server'

import { getSessionUserOrNull, listRoomsForUser } from '@/lib/server-data'

export async function GET() {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rooms = await listRoomsForUser(me.id)
  return NextResponse.json(rooms)
}
