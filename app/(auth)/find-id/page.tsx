'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { requestFindIdCode, verifyFindIdCode } from '@/lib/auth-client'

const JBNU_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@jbnu\.ac\.kr$/i
const RESEND_COOLDOWN_SEC = 60

export default function FindIdPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'input' | 'sent'>('input')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldownSec, setResendCooldownSec] = useState(0)
  const [foundLoginId, setFoundLoginId] = useState<string | null>(null)

  useEffect(() => {
    if (resendCooldownSec <= 0) return
    const t = setTimeout(() => setResendCooldownSec((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldownSec])

  async function handleSendCode() {
    if (!JBNU_EMAIL_RE.test(email)) {
      setError('전북대 이메일(@jbnu.ac.kr)을 입력해 주세요.')
      return
    }
    setSending(true)
    setError(null)
    const result = await requestFindIdCode(email)
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
    const result = await verifyFindIdCode(email, code)
    setVerifying(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setFoundLoginId(result.loginId)
  }

  return (
    <>
      <AppHeader title="아이디 찾기" showBack onBack={() => router.push('/login')} />
      <div className="flex flex-1 flex-col justify-center px-6 pb-10">
      <Card className="mt-6 p-5">
        {foundLoginId ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <Check className="size-10 text-status-ordered" />
            <p className="text-sm text-muted-foreground">
              회원님의 아이디는
              <br />
              <span className="text-lg font-bold text-foreground">{foundLoginId}</span>
              <br />
              입니다.
            </p>
            <Button
              type="button"
              onClick={() => router.push('/login')}
              className="h-11 w-full rounded-xl font-bold"
            >
              로그인하기
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="202012345@jbnu.ac.kr"
                value={email}
                disabled={phase === 'sent'}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={sending || !JBNU_EMAIL_RE.test(email) || resendCooldownSec > 0}
                onClick={handleSendCode}
                className="h-12 shrink-0 gap-1.5 rounded-xl px-3 text-sm font-semibold"
              >
                {sending && <Loader2 className="size-3.5 animate-spin" />}
                {phase === 'input' ? '인증번호 받기' : resendCooldownSec > 0 ? `재전송 ${resendCooldownSec}s` : '재전송'}
              </Button>
            </div>

            {phase === 'sent' && (
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="인증번호 6자리"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                />
                <Button
                  type="button"
                  disabled={verifying || code.length === 0}
                  onClick={handleVerify}
                  className="h-12 shrink-0 gap-1.5 rounded-xl px-3 text-sm font-semibold"
                >
                  {verifying && <Loader2 className="size-3.5 animate-spin" />}
                  확인
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              가입 시 인증한 전북대 이메일이 연동된 계정만 아이디를 찾을 수 있어요.
            </p>
          </div>
        )}
      </Card>
      </div>
    </>
  )
}
