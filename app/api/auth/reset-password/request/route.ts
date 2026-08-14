import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requestVerificationCode } from '@/lib/email-verification'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const loginId = typeof body?.loginId === 'string' ? body.loginId.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!loginId || !JBNU_EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 })
  }

  const [user] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.loginId, loginId), eq(users.jbnuEmail, email)))
    .limit(1)
  if (!user) {
    return NextResponse.json({ error: '아이디와 이메일이 일치하는 계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  const result = await requestVerificationCode(email, 'RESET_PASSWORD')
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true })
}
