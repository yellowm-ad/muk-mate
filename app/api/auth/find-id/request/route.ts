import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requestVerificationCode } from '@/lib/email-verification'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!JBNU_EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '전북대 이메일(@jbnu.ac.kr)만 사용할 수 있습니다.' }, { status: 400 })
  }

  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.jbnuEmail, email)).limit(1)
  if (!user) {
    return NextResponse.json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  const result = await requestVerificationCode(email, 'FIND_ID')
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true })
}
