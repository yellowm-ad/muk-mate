import { NextResponse } from 'next/server'
import { getNotificationsForUser, getSessionUserOrNull } from '@/lib/server-data'

export async function GET(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ code: 'UNAUTHORIZED', error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const cursorParam = searchParams.get('cursor')
  const limitParam = searchParams.get('limit')

  const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20

  const result = await getNotificationsForUser(me.id, cursor, limit)
  return NextResponse.json(result)
}
