'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { confirmResetPassword, requestResetPasswordCode, verifyResetPasswordCode } from '@/lib/auth-client'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i
const RESEND_COOLDOWN_SEC = 60
const PASSWORD_MIN = 4
const PASSWORD_MAX = 16

type Phase = 'input' | 'sent' | 'verified' | 'done'

export default function FindPasswordPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldownSec, setResendCooldownSec] = useState(0)

  const passwordMismatch = newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm

  useEffect(() => {
    if (resendCooldownSec <= 0) return
    const t = setTimeout(() => setResendCooldownSec((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldownSec])

  async function handleSendCode() {
    if (!loginId || !JBNU_EMAIL_RE.test(email)) {
      setError('아이디와 전북대 이메일(@jbnu.ac.kr)을 모두 입력해 주세요.')
      return
    }
    setSending(true)
    setError(null)
    const result = await requestResetPasswordCode(loginId, email)
    setSending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPhase('sent')
    setResendCooldownSec(RESEND_COOLDOWN_SEC)
  }

  async function handleVerify() {
    if (code.length === 0) return
    setVerifying(true)
    setError(null)
    const result = await verifyResetPasswordCode(loginId, email, code)
    setVerifying(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPhase('verified')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (passwordMismatch || newPassword.length < PASSWORD_MIN) return
    setSubmitting(true)
    setError(null)
    const result = await confirmResetPassword(loginId, email, code, newPassword)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPhase('done')
  }

  return (
    <>
      <AppHeader title="비밀번호 찾기" showBack onBack={() => router.push('/login')} />
      <div className="flex flex-1 flex-col justify-center px-6 pb-10">
        <Card className="mt-6 p-5">
          {phase === 'done' ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <Check className="size-10 text-status-ordered" />
              <p className="text-sm text-muted-foreground">비밀번호가 재설정됐어요.</p>
              <Button type="button" onClick={() => router.push('/login')} className="h-11 w-full rounded-xl font-bold">
                로그인하기
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                type="text"
                placeholder="아이디"
                value={loginId}
                disabled={phase !== 'input'}
                onChange={(e) => {
                  setLoginId(e.target.value)
                  setError(null)
                }}
              />
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="202012345@jbnu.ac.kr"
                  value={email}
                  disabled={phase !== 'input' && phase !== 'sent'}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    sending ||
                    phase === 'verified' ||
                    !loginId ||
                    !JBNU_EMAIL_RE.test(email) ||
                    resendCooldownSec > 0
                  }
                  onClick={handleSendCode}
                  className="h-12 shrink-0 gap-1.5 rounded-xl px-3 text-sm font-semibold"
                >
                  {sending && <Loader2 className="size-3.5 animate-spin" />}
                  {phase === 'input' ? '인증번호 받기' : resendCooldownSec > 0 ? `재전송 ${resendCooldownSec}s` : '재전송'}
                </Button>
              </div>

              {(phase === 'sent' || phase === 'verified') && (
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="인증번호 6자리"
                    value={code}
                    disabled={phase === 'verified'}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                  <Button
                    type="button"
                    disabled={verifying || phase === 'verified' || code.length === 0}
                    onClick={handleVerify}
                    className="h-12 shrink-0 gap-1.5 rounded-xl px-3 text-sm font-semibold"
                  >
                    {verifying && <Loader2 className="size-3.5 animate-spin" />}
                    확인
                  </Button>
                </div>
              )}

              {phase === 'verified' && (
                <>
                  <Input
                    type="password"
                    placeholder={`새 비밀번호 (${PASSWORD_MIN}~${PASSWORD_MAX}자)`}
                    value={newPassword}
                    maxLength={PASSWORD_MAX}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="새 비밀번호 확인"
                    value={newPasswordConfirm}
                    maxLength={PASSWORD_MAX}
                    aria-invalid={passwordMismatch}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  />
                  {passwordMismatch && <p className="text-xs text-destructive">비밀번호가 일치하지 않아요.</p>}

                  <Button
                    type="submit"
                    disabled={submitting || newPassword.length < PASSWORD_MIN || passwordMismatch}
                    className="h-11 w-full rounded-xl font-bold"
                  >
                    {submitting ? '변경하는 중...' : '비밀번호 재설정'}
                  </Button>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                가입 시 인증한 전북대 이메일이 연동된 계정만 비밀번호를 재설정할 수 있어요.
              </p>
            </form>
          )}
        </Card>
      </div>
    </>
  )
}
