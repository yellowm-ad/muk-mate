import { NextResponse } from 'next/server'
import { getSessionUserOrNull, getUnreadNotificationCount } from '@/lib/server-data'

export async function GET() {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ unreadCount: 0 })
  }

  const unreadCount = await getUnreadNotificationCount(me.id)
  return NextResponse.json({ unreadCount })
}
