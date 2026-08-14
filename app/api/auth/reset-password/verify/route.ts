import { NextResponse } from 'next/server'

import { checkVerificationCode } from '@/lib/email-verification'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const loginId = typeof body?.loginId === 'string' ? body.loginId.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!loginId || !JBNU_EMAIL_RE.test(email) || !code) {
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 })
  }

  // 이 단계는 UI에 즉시 피드백을 주기 위한 확인일 뿐 소모하지 않는다 — 실제 소모는 confirm에서 한다.
  const result = await checkVerificationCode(email, code, 'RESET_PASSWORD')
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true })
}
