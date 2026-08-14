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
