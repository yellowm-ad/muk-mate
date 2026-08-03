'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Check, Loader2, MapPin, Navigation } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SIGNUP_DRAFT_KEY, ZONES } from '@/lib/constants'
import { signup } from '@/lib/auth-client'
import type { ZoneCode } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SignupDraft {
  loginId: string
  password: string
  nickname: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<SignupDraft | null>(null)
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState('')
  const [zone, setZone] = useState<ZoneCode | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY)
    if (!raw) {
      router.replace('/signup')
      return
    }
    try {
      const parsed = JSON.parse(raw) as SignupDraft
      setDraft(parsed)
      setNickname(parsed.nickname)
    } catch {
      router.replace('/signup')
    }
  }, [router])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleFinish() {
    if (!draft || !zone) return
    setSubmitting(true)
    setSubmitError(null)

    const result = await signup({ loginId: draft.loginId, password: draft.password, nickname, zoneCode: zone })
    if (!result.ok) {
      setSubmitError(result.error)
      setSubmitting(false)
      return
    }

    const signInResult = await signIn('credentials', {
      loginId: draft.loginId,
      password: draft.password,
      redirect: false,
    })
    sessionStorage.removeItem(SIGNUP_DRAFT_KEY)

    if (signInResult?.error) {
      router.push('/login')
      return
    }

    // 방금 가입 직후 자동 로그인이라 "로그인 상태 유지"를 켠 것으로 간주
    await fetch('/api/auth/session-guard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remember: true }),
    })

    router.push('/pots')
  }

  function handleNext() {
    if (step === 1) {
      setStep(2)
      return
    }
    void handleFinish()
  }

  if (!draft) return null

  return (
    <>
      <AppHeader
        title="초기 설정"
        showBack={step === 2}
        onBack={() => setStep(1)}
      />

      {/* 진행 인디케이터 (2단계) */}
      <div className="flex items-center gap-2 px-6 pt-4">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              s <= step ? 'bg-primary' : 'bg-muted-foreground/20',
            )}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col px-6 pt-6 pb-8">
        {step === 1 ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-foreground text-balance">
              사용할 닉네임을 확인해 주세요
            </h2>
            <p className="text-sm text-muted-foreground">
              채팅과 모집글에서 다른 사람에게 보여지는 이름이에요.
            </p>
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="nickname" className="text-sm font-semibold text-foreground">
                닉네임
              </label>
              <Input
                id="nickname"
                value={nickname}
                maxLength={12}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-foreground text-balance">
              주로 활동하는 지역을 골라주세요
            </h2>
            <p className="text-sm text-muted-foreground">
              내 지역의 공동주문을 먼저 보여드려요.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {ZONES.map((z) => {
                const selected = zone === z.code
                return (
                  <button
                    key={z.code}
                    type="button"
                    onClick={() => setZone(z.code)}
                    className={cn(
                      'flex min-h-24 flex-col items-start justify-between rounded-2xl border-2 p-4 text-left transition active:scale-[0.98]',
                      selected
                        ? 'border-primary bg-primary-soft'
                        : 'border-border bg-card hover:border-muted-foreground/30',
                    )}
                  >
                    <MapPin
                      className={cn('size-5', selected ? 'text-primary' : 'text-muted-foreground')}
                    />
                    <span
                      className={cn(
                        'text-base font-bold',
                        selected ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {z.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setToast('현재 위치를 확인하는 기능은 준비 중이에요.')}
              className="mt-4 h-11 w-full gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98]"
            >
              <Navigation className="size-4" />
              현재 위치로 자동 설정
            </Button>

            {submitError && (
              <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-destructive/10 p-3.5">
                <p className="text-sm text-destructive">{submitError}</p>
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.removeItem(SIGNUP_DRAFT_KEY)
                    router.replace('/signup')
                  }}
                  className="self-start text-xs font-semibold text-destructive underline underline-offset-4"
                >
                  아이디 다시 정하기
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto pt-6">
          <Button
            type="button"
            onClick={handleNext}
            disabled={(step === 2 && !zone) || submitting}
            className="h-12 w-full gap-1.5 rounded-xl text-base font-bold transition active:scale-[0.98]"
          >
            {step === 1 ? (
              '다음'
            ) : submitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                가입하는 중...
              </>
            ) : (
              <>
                <Check className="size-5" />
                시작하기
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 간단한 토스트 */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <div className="rounded-full bg-foreground/90 px-4 py-2.5 text-sm font-medium text-background shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </>
  )
}
