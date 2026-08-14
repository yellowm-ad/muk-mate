// 이메일 인증번호 발급·검증·소모 공통 로직 — 회원가입/아이디 찾기/비밀번호 찾기/아이디 변경이 전부 공유한다.
// purpose로 용도를 구분해서, 한 목적으로 받은 코드가 다른 목적에 재사용되지 않도록 항상 함께 필터링한다.
import 'server-only'

import crypto from 'crypto'

import { and, desc, eq, gt, isNull } from 'drizzle-orm'

import bcrypt from 'bcryptjs'

import { getDb } from '@/lib/db'
import { emailVerifications } from '@/lib/db/schema'
import { sendJbnuVerificationEmail } from '@/lib/email'
import type { EmailVerificationPurpose } from '@/lib/types'

const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_REQUESTS_PER_HOUR = 5
const MAX_ATTEMPTS = 5
export const VERIFICATION_REUSE_WINDOW_MS = 30 * 60 * 1000

type Result = { ok: true } | { ok: false; status: number; error: string }

/** 인증번호 발급 + 발송. rate limit(60초 쿨다운, 시간당 5회)도 여기서 함께 처리한다. */
export async function requestVerificationCode(email: string, purpose: EmailVerificationPurpose): Promise<Result> {
  const db = getDb()

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recent = await db
    .select({ createdAt: emailVerifications.createdAt })
    .from(emailVerifications)
    .where(and(eq(emailVerifications.email, email), gt(emailVerifications.createdAt, oneHourAgo)))
    .orderBy(desc(emailVerifications.createdAt))

  if (recent.length > 0 && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, status: 429, error: '잠시 후 다시 시도해 주세요.' }
  }
  if (recent.length >= MAX_REQUESTS_PER_HOUR) {
    return { ok: false, status: 429, error: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  const code = crypto.randomInt(100000, 1000000).toString()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)

  await db.insert(emailVerifications).values({ email, purpose, codeHash, expiresAt })

  try {
    await sendJbnuVerificationEmail(email, code)
  } catch (err) {
    console.error('[email-verification] failed to send email', err)
    return { ok: false, status: 500, error: '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  return { ok: true }
}

/** 인증번호 확인(만료·시도횟수·불일치 처리). 일치하면 verifiedAt만 세팅하고 소모하지는 않는다. */
export async function checkVerificationCode(
  email: string,
  code: string,
  purpose: EmailVerificationPurpose,
): Promise<Result> {
  const db = getDb()

  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email),
        eq(emailVerifications.purpose, purpose),
        isNull(emailVerifications.consumedAt),
      ),
    )
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1)

  if (!row) {
    return { ok: false, status: 400, error: '인증 요청을 먼저 진행해 주세요.' }
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 400, error: '인증번호가 만료되었습니다. 다시 요청해 주세요.' }
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 400, error: '시도 횟수를 초과했습니다. 다시 요청해 주세요.' }
  }

  const matches = await bcrypt.compare(code, row.codeHash)
  if (!matches) {
    await db
      .update(emailVerifications)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerifications.id, row.id))
    return { ok: false, status: 400, error: '인증번호가 올바르지 않습니다.' }
  }

  if (!row.verifiedAt) {
    await db.update(emailVerifications).set({ verifiedAt: new Date() }).where(eq(emailVerifications.id, row.id))
  }

  return { ok: true }
}

/**
 * 실제 실행(가입 완료/비밀번호 변경/아이디 변경) 직전에 서버가 직접 재확인한다 — 클라이언트가 보낸
 * "인증됨" 플래그를 신뢰하지 않는다는 원칙. 아직 소모(consumedAt)는 하지 않는다 — 호출부가 뒤이은
 * 실제 변경(users insert/update)에 성공한 뒤 markVerificationConsumed로 따로 소모해야 한다
 * (먼저 소모해버리면 그 뒤 변경이 실패했을 때 인증 자체를 잃어버린다).
 */
export async function getValidVerification(
  email: string,
  purpose: EmailVerificationPurpose,
  maxAgeMs: number = VERIFICATION_REUSE_WINDOW_MS,
): Promise<{ id: string; verifiedAt: Date } | null> {
  const db = getDb()

  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email),
        eq(emailVerifications.purpose, purpose),
        isNull(emailVerifications.consumedAt),
      ),
    )
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1)

  if (!row?.verifiedAt || Date.now() - row.verifiedAt.getTime() > maxAgeMs) {
    return null
  }
  return { id: row.id, verifiedAt: row.verifiedAt }
}

/** getValidVerification이 돌려준 id를 실제 변경이 성공한 뒤에 호출해 소모 처리한다. */
export async function markVerificationConsumed(id: string): Promise<void> {
  await getDb().update(emailVerifications).set({ consumedAt: new Date() }).where(eq(emailVerifications.id, id))
}
