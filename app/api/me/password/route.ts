import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSessionUserOrNull } from '@/lib/server-data'

const PASSWORD_MIN = 4
const PASSWORD_MAX = 16

export async function PATCH(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!currentPassword) {
    return NextResponse.json({ error: '현재 비밀번호를 입력해 주세요.' }, { status: 400 })
  }
  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    return NextResponse.json(
      { error: `새 비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자여야 합니다.` },
      { status: 400 },
    )
  }

  const db = getDb()
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  const valid = await bcrypt.compare(currentPassword, row.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 403 })
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, me.id))

  return NextResponse.json({ ok: true })
}
