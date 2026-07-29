'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, MapPin, Navigation } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ZONES } from '@/lib/constants'
import type { ZoneCode } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState('배고픈북극곰')
  const [zone, setZone] = useState<ZoneCode | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  function handleNext() {
    if (step === 1) {
      setStep(2)
      return
    }
    router.push('/pots')
  }

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
          </div>
        )}

        <div className="mt-auto pt-6">
          <Button
            type="button"
            onClick={handleNext}
            disabled={step === 2 && !zone}
            className="h-12 w-full gap-1.5 rounded-xl text-base font-bold transition active:scale-[0.98]"
          >
            {step === 1 ? (
              '다음'
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
