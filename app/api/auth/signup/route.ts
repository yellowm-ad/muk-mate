import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { getDb, getPgErrorCode } from '@/lib/db'
import { mannerProfiles, users, zones } from '@/lib/db/schema'
import { MANNER_AVATAR_COLOR_META } from '@/lib/constants'
import { getValidVerification, markVerificationConsumed } from '@/lib/email-verification'
import type { MannerAvatarColor } from '@/lib/types'

const LOGIN_ID_MIN = 4
const LOGIN_ID_MAX = 10
const PASSWORD_MIN = 4
const PASSWORD_MAX = 16
const NICKNAME_MAX = 12
const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i

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
  const jbnuEmail = typeof body.jbnuEmail === 'string' ? body.jbnuEmail.trim().toLowerCase() : ''
  // v2.15: 온보딩에서 아바타 색상을 함께 고를 수 있다(선택) — 잘못된 값이 와도 가입 자체는 막지 않고 기본값으로 처리
  const avatarColor: MannerAvatarColor =
    typeof body.avatarColor === 'string' && body.avatarColor in MANNER_AVATAR_COLOR_META
      ? (body.avatarColor as MannerAvatarColor)
      : 'NAVY'

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
  if (!JBNU_EMAIL_RE.test(jbnuEmail)) {
    return NextResponse.json({ error: '전북대 이메일 인증을 완료해 주세요.' }, { status: 400 })
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

  // 서버가 직접 인증 여부를 재확인한다 — 클라이언트가 "인증됨" 플래그만 보내는 걸 신뢰하지 않는다.
  const verification = await getValidVerification(jbnuEmail, 'SIGNUP')
  if (!verification) {
    return NextResponse.json({ error: '이메일 인증을 다시 진행해 주세요.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const [created] = await db
      .insert(users)
      .values({ loginId, passwordHash, nickname, zoneCode, jbnuEmail, jbnuEmailVerifiedAt: verification.verifiedAt })
      .returning({ id: users.id, nickname: users.nickname, zoneCode: users.zoneCode })

    // 매너 프로필은 첫 접근 시 lazy 생성이 기본(ensureMannerProfile)이지만, 온보딩에서 고른
    // 색상을 반영하려면 가입 시점에 먼저 만들어 둬야 한다 — 소품은 기본값(NONE) 그대로.
    await db.insert(mannerProfiles).values({ userId: created.id, avatarColor }).onConflictDoNothing({ target: mannerProfiles.userId })

    // user insert가 먼저 성공한 뒤에만 소모 처리한다 — 실패하면 재시도 시 같은 인증을 다시 쓸 수 있어야 한다.
    await markVerificationConsumed(verification.id)

    return NextResponse.json({ user: created }, { status: 201 })
  } catch (err) {
    const code = getPgErrorCode(err)
    if (code === UNIQUE_VIOLATION) {
      const message = /jbnu_email/.test(String((err as { cause?: { constraint?: string } })?.cause?.constraint ?? ''))
        ? '이미 사용 중인 전북대 이메일입니다.'
        : '이미 사용 중인 아이디입니다.'
      return NextResponse.json({ error: message }, { status: 409 })
    }
    throw err
  }
}
