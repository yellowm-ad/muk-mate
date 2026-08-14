// 회원가입 관련 REST 호출 — 로그인/로그아웃 자체는 next-auth/react의 signIn/signOut을 그대로 쓴다.

export async function checkLoginIdAvailable(loginId: string): Promise<boolean> {
  const res = await fetch(`/api/auth/check-id?loginId=${encodeURIComponent(loginId)}`)
  if (!res.ok) return false
  const data = (await res.json()) as { available?: boolean }
  return Boolean(data.available)
}

export interface SignupInput {
  loginId: string
  password: string
  nickname: string
  zoneCode: string
  /** 온보딩에서 고른 아바타 색상(선택) — 안 주면 서버가 기본값(NAVY)으로 처리 */
  avatarColor?: string
  /** 온보딩에서 인증 완료한 전북대 이메일 — 서버가 email_verifications로 재검증한다 */
  jbnuEmail: string
}

export async function signup(input: SignupInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: data?.error ?? '회원가입에 실패했습니다.' }
  }

  return { ok: true }
}

async function postAuthJson(
  path: string,
  body: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: data?.error ?? '요청에 실패했습니다.' }
  }
  return { ok: true }
}

/** 전북대 이메일로 인증번호 발송 요청 */
export async function requestJbnuEmailCode(email: string) {
  return postAuthJson('/api/auth/jbnu-email/request', { email })
}

/** 전북대 이메일 인증번호 확인 */
export async function verifyJbnuEmailCode(email: string, code: string) {
  return postAuthJson('/api/auth/jbnu-email/verify', { email, code })
}

// ─────────────────────────────────────────────────────────────
// 아이디 찾기 / 비밀번호 찾기 — 둘 다 비로그인 상태에서 쓴다.
// ─────────────────────────────────────────────────────────────

/** 아이디 찾기: 이메일로 인증번호 발송 요청 */
export async function requestFindIdCode(email: string) {
  return postAuthJson('/api/auth/find-id/request', { email })
}

/** 아이디 찾기: 인증번호 확인 후 로그인 아이디 반환 */
export async function verifyFindIdCode(
  email: string,
  code: string,
): Promise<{ ok: true; loginId: string } | { ok: false; error: string }> {
  const res = await fetch('/api/auth/find-id/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  const data = (await res.json().catch(() => null)) as { loginId?: string; error?: string } | null
  if (!res.ok || !data?.loginId) {
    return { ok: false, error: data?.error ?? '요청에 실패했습니다.' }
  }
  return { ok: true, loginId: data.loginId }
}

/** 비밀번호 찾기: 아이디+이메일로 인증번호 발송 요청 */
export async function requestResetPasswordCode(loginId: string, email: string) {
  return postAuthJson('/api/auth/reset-password/request', { loginId, email })
}

/** 비밀번호 찾기: 인증번호 확인(UI 즉시 피드백용 — 아직 소모하지 않음) */
export async function verifyResetPasswordCode(loginId: string, email: string, code: string) {
  return postAuthJson('/api/auth/reset-password/verify', { loginId, email, code })
}

/** 비밀번호 찾기: 인증번호 재확인 + 새 비밀번호로 실제 변경 */
export async function confirmResetPassword(loginId: string, email: string, code: string, newPassword: string) {
  return postAuthJson('/api/auth/reset-password/confirm', { loginId, email, code, newPassword })
}
