import { and, desc, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { getDb } from '@/lib/db'
import { emailVerifications } from '@/lib/db/schema'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i
const MAX_ATTEMPTS = 5

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!JBNU_EMAIL_RE.test(email) || !code) {
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 })
  }

  const db = getDb()

  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(and(eq(emailVerifications.email, email), isNull(emailVerifications.consumedAt)))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: '인증 요청을 먼저 진행해 주세요.' }, { status: 400 })
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 요청해 주세요.' }, { status: 400 })
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: '시도 횟수를 초과했습니다. 다시 요청해 주세요.' }, { status: 400 })
  }

  const matches = await bcrypt.compare(code, row.codeHash)
  if (!matches) {
    await db
      .update(emailVerifications)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerifications.id, row.id))
    return NextResponse.json({ error: '인증번호가 올바르지 않습니다.' }, { status: 400 })
  }

  if (!row.verifiedAt) {
    await db.update(emailVerifications).set({ verifiedAt: new Date() }).where(eq(emailVerifications.id, row.id))
  }

  return NextResponse.json({ ok: true })
}
