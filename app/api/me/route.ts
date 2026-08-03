import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { getDb } from '@/lib/db'
import { users, zones } from '@/lib/db/schema'
import { getSessionUserOrNull, withdrawUser } from '@/lib/server-data'

const NICKNAME_MAX = 12

export async function PATCH(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''
  const zoneCode = typeof body?.zoneCode === 'string' ? body.zoneCode : ''

  if (!nickname || nickname.length > NICKNAME_MAX) {
    return NextResponse.json({ error: '닉네임을 확인해 주세요.' }, { status: 400 })
  }
  if (!zoneCode) {
    return NextResponse.json({ error: '활동 지역을 선택해 주세요.' }, { status: 400 })
  }

  const db = getDb()
  const [zone] = await db.select({ code: zones.code }).from(zones).where(eq(zones.code, zoneCode)).limit(1)
  if (!zone) {
    return NextResponse.json({ error: '올바르지 않은 활동 지역입니다.' }, { status: 400 })
  }

  const [updated] = await db
    .update(users)
    .set({ nickname, zoneCode })
    .where(eq(users.id, me.id))
    .returning({ nickname: users.nickname, zoneCode: users.zoneCode })

  return NextResponse.json({ user: updated })
}

/** 회원 탈퇴(소프트) — 현재 비밀번호 확인 후 계정을 비활성화한다. 완전 삭제는 하지 않는다(withdrawUser 참고). */
export async function DELETE(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  if (!currentPassword) {
    return NextResponse.json({ error: '현재 비밀번호를 입력해 주세요.' }, { status: 400 })
  }

  const db = getDb()
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1)
  if (!row) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  const valid = await bcrypt.compare(currentPassword, row.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 403 })
  }

  await withdrawUser(me.id)

  return NextResponse.json({ ok: true })
}
