import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { getDb, getPgErrorCode } from '@/lib/db'
import { users, zones } from '@/lib/db/schema'

const LOGIN_ID_MIN = 4
const LOGIN_ID_MAX = 10
const PASSWORD_MIN = 4
const PASSWORD_MAX = 16
const NICKNAME_MAX = 12

// Postgres unique_violation SQLSTATE — 중복확인을 통과했더라도 동시 가입 요청이 있을 수 있어 방어
const UNIQUE_VIOLATION = '23505'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  const loginId = typeof body.loginId === 'string' ? body.loginId.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
  const zoneCode = typeof body.zoneCode === 'string' ? body.zoneCode : ''

  if (loginId.length < LOGIN_ID_MIN || loginId.length > LOGIN_ID_MAX) {
    return NextResponse.json(
      { error: `아이디는 ${LOGIN_ID_MIN}~${LOGIN_ID_MAX}자여야 합니다.` },
      { status: 400 },
    )
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return NextResponse.json(
      { error: `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자여야 합니다.` },
      { status: 400 },
    )
  }
  if (nickname.length === 0 || nickname.length > NICKNAME_MAX) {
    return NextResponse.json({ error: '닉네임을 입력해 주세요.' }, { status: 400 })
  }
  if (!zoneCode) {
    return NextResponse.json({ error: '활동 지역을 선택해 주세요.' }, { status: 400 })
  }

  const db = getDb()

  const [zone] = await db.select({ code: zones.code }).from(zones).where(eq(zones.code, zoneCode)).limit(1)
  if (!zone) {
    return NextResponse.json({ error: '올바르지 않은 활동 지역입니다.' }, { status: 400 })
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.loginId, loginId)).limit(1)
  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const [created] = await db
      .insert(users)
      .values({ loginId, passwordHash, nickname, zoneCode })
      .returning({ id: users.id, nickname: users.nickname, zoneCode: users.zoneCode })

    return NextResponse.json({ user: created }, { status: 201 })
  } catch (err) {
    const code = getPgErrorCode(err)
    if (code === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 })
    }
    throw err
  }
}
