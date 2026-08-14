import crypto from 'crypto'

import { and, desc, eq, gt } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { getDb } from '@/lib/db'
import { emailVerifications, users } from '@/lib/db/schema'
import { sendJbnuVerificationEmail } from '@/lib/email'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i
const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_REQUESTS_PER_HOUR = 5

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!JBNU_EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '전북대 이메일(@jbnu.ac.kr)만 사용할 수 있습니다.' }, { status: 400 })
  }

  const db = getDb()

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.jbnuEmail, email)).limit(1)
  if (existingUser) {
    return NextResponse.json({ error: '이미 사용 중인 전북대 이메일입니다.' }, { status: 409 })
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recent = await db
    .select({ createdAt: emailVerifications.createdAt })
    .from(emailVerifications)
    .where(and(eq(emailVerifications.email, email), gt(emailVerifications.createdAt, oneHourAgo)))
    .orderBy(desc(emailVerifications.createdAt))

  if (recent.length > 0 && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 })
  }
  if (recent.length >= MAX_REQUESTS_PER_HOUR) {
    return NextResponse.json({ error: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429 })
  }

  const code = crypto.randomInt(100000, 1000000).toString()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)

  await db.insert(emailVerifications).values({ email, codeHash, expiresAt })

  try {
    await sendJbnuVerificationEmail(email, code)
  } catch (err) {
    console.error('[jbnu-email/request] failed to send email', err)
    return NextResponse.json({ error: '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
