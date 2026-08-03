import { NextResponse } from 'next/server'

import { REMEMBER_GUARD_COOKIE, REMEMBER_MAX_AGE_SECONDS } from '@/lib/auth-constants'

/** 로그인 직후 클라이언트가 호출 — "로그인 상태 유지" 체크 여부에 따라 가드 쿠키를 발급한다. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const remember = body?.remember === true

  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: REMEMBER_GUARD_COOKIE,
    value: '1',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    // remember가 false면 maxAge를 아예 안 줘서 브라우저 세션 쿠키(종료 시 자동 삭제)로 만든다.
    ...(remember ? { maxAge: REMEMBER_MAX_AGE_SECONDS } : {}),
  })
  return res
}

/** 로그아웃 시 클라이언트가 호출 — 가드 쿠키를 정리한다(안 지워도 동작엔 문제없지만 깔끔하게). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(REMEMBER_GUARD_COOKIE)
  return res
}
