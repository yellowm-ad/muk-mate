import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requestVerificationCode } from '@/lib/email-verification'
import { getSessionUserOrNull } from '@/lib/server-data'

export async function POST() {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const [row] = await getDb().select({ jbnuEmail: users.jbnuEmail }).from(users).where(eq(users.id, me.id)).limit(1)
  if (!row?.jbnuEmail) {
    return NextResponse.json({ error: '전북대 이메일이 연동되지 않아 아이디를 변경할 수 없어요.' }, { status: 400 })
  }

  const result = await requestVerificationCode(row.jbnuEmail, 'CHANGE_LOGIN_ID')
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true })
}
