import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { checkVerificationCode, getValidVerification, markVerificationConsumed } from '@/lib/email-verification'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!JBNU_EMAIL_RE.test(email) || !code) {
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 })
  }

  const checkResult = await checkVerificationCode(email, code, 'FIND_ID')
  if (!checkResult.ok) {
    return NextResponse.json({ error: checkResult.error }, { status: checkResult.status })
  }

  // 찾기 목적이라 이후 이어지는 단계가 없다 — 바로 재확인·소모하고 아이디를 돌려준다.
  const verification = await getValidVerification(email, 'FIND_ID')
  if (!verification) {
    return NextResponse.json({ error: '인증 요청을 먼저 진행해 주세요.' }, { status: 400 })
  }

  const [user] = await getDb().select({ loginId: users.loginId }).from(users).where(eq(users.jbnuEmail, email)).limit(1)
  if (!user) {
    return NextResponse.json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  await markVerificationConsumed(verification.id)

  return NextResponse.json({ loginId: user.loginId })
}
