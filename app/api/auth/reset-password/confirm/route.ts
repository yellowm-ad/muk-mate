import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getValidVerification, markVerificationConsumed } from '@/lib/email-verification'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i
const PASSWORD_MIN = 4
const PASSWORD_MAX = 16

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const loginId = typeof body?.loginId === 'string' ? body.loginId.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!loginId || !JBNU_EMAIL_RE.test(email) || !code) {
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 })
  }
  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    return NextResponse.json(
      { error: `새 비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자여야 합니다.` },
      { status: 400 },
    )
  }

  const db = getDb()

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.loginId, loginId), eq(users.jbnuEmail, email)))
    .limit(1)
  if (!user) {
    return NextResponse.json({ error: '아이디와 이메일이 일치하는 계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 클라이언트가 앞서 verify를 통과했다는 신호를 신뢰하지 않고 서버가 직접 재확인한다.
  const verification = await getValidVerification(email, 'RESET_PASSWORD')
  if (!verification) {
    return NextResponse.json({ error: '이메일 인증을 다시 진행해 주세요.' }, { status: 409 })
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id))
  await markVerificationConsumed(verification.id)

  return NextResponse.json({ ok: true })
}
