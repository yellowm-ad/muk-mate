import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { getDb, getPgErrorCode } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getValidVerification, markVerificationConsumed } from '@/lib/email-verification'
import { getSessionUserOrNull } from '@/lib/server-data'

const LOGIN_ID_MIN = 4
const LOGIN_ID_MAX = 10
const UNIQUE_VIOLATION = '23505'

export async function PATCH(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const newLoginId = typeof body?.newLoginId === 'string' ? body.newLoginId.trim() : ''
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''

  if (!code || !currentPassword) {
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 })
  }
  if (newLoginId.length < LOGIN_ID_MIN || newLoginId.length > LOGIN_ID_MAX) {
    return NextResponse.json(
      { error: `아이디는 ${LOGIN_ID_MIN}~${LOGIN_ID_MAX}자여야 합니다.` },
      { status: 400 },
    )
  }

  const db = getDb()

  const [row] = await db
    .select({ jbnuEmail: users.jbnuEmail, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1)
  if (!row) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!row.jbnuEmail) {
    return NextResponse.json({ error: '전북대 이메일이 연동되지 않아 아이디를 변경할 수 없어요.' }, { status: 400 })
  }

  const passwordValid = await bcrypt.compare(currentPassword, row.passwordHash)
  if (!passwordValid) {
    return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 403 })
  }

  // 클라이언트가 앞서 verify-code를 통과했다는 신호를 신뢰하지 않고 서버가 직접 재확인한다.
  const verification = await getValidVerification(row.jbnuEmail, 'CHANGE_LOGIN_ID')
  if (!verification) {
    return NextResponse.json({ error: '이메일 인증을 다시 진행해 주세요.' }, { status: 409 })
  }

  try {
    await db.update(users).set({ loginId: newLoginId }).where(eq(users.id, me.id))
    await markVerificationConsumed(verification.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const errCode = getPgErrorCode(err)
    if (errCode === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 })
    }
    throw err
  }
}
