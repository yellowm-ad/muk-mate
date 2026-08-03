'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkLoginIdAvailable } from '@/lib/auth-client'
import { SIGNUP_DRAFT_KEY } from '@/lib/constants'

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {value}/{max}
    </span>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [idChecked, setIdChecked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm
  const canSubmit =
    idChecked &&
    loginId.length >= 4 &&
    password.length >= 4 &&
    passwordConfirm.length > 0 &&
    nickname.length > 0 &&
    !passwordMismatch

  async function handleCheckId() {
    setChecking(true)
    setCheckError(null)
    try {
      const available = await checkLoginIdAvailable(loginId)
      setIdChecked(available)
      if (!available) setCheckError('이미 사용 중인 아이디예요.')
    } catch {
      setIdChecked(false)
      setCheckError('중복확인에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setChecking(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ loginId, password, nickname }))
    router.push('/onboarding')
  }

  return (
    <>
      <AppHeader title="회원가입" showBack onBack={() => router.push('/login')} />
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col px-6 pt-4 pb-8">
        <div className="flex flex-col gap-5">
          {/* 아이디 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="loginId" className="text-sm font-semibold text-foreground">
                아이디
              </label>
              <Counter value={loginId.length} max={10} />
            </div>
            <div className="flex gap-2">
              <Input
                id="loginId"
                value={loginId}
                maxLength={10}
                placeholder="영문·숫자 4~10자"
                onChange={(e) => {
                  setLoginId(e.target.value)
                  setIdChecked(false)
                  setCheckError(null)
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={loginId.length < 4 || checking}
                onClick={handleCheckId}
                className="h-12 shrink-0 gap-1.5 rounded-xl px-3 text-sm font-semibold transition active:scale-[0.98]"
              >
                {checking && <Loader2 className="size-3.5 animate-spin" />}
                중복확인
              </Button>
            </div>
            <p
              className={`text-xs ${
                idChecked
                  ? 'flex items-center gap-1 text-status-ordered'
                  : checkError
                    ? 'text-destructive'
                    : 'text-muted-foreground'
              }`}
            >
              {idChecked ? (
                <>
                  <Check className="size-3.5" /> 사용 가능한 아이디예요.
                </>
              ) : checkError ? (
                checkError
              ) : (
                '로그인에 사용할 아이디를 입력하세요 (4~10자).'
              )}
            </p>
          </div>

          {/* 비밀번호 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-semibold text-foreground">
                비밀번호
              </label>
              <Counter value={password.length} max={16} />
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              maxLength={16}
              placeholder="4~16자"
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">잊어버리지 않도록 주의하세요.</p>
          </div>

          {/* 비밀번호 확인 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="passwordConfirm" className="text-sm font-semibold text-foreground">
              비밀번호 확인
            </label>
            <Input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              maxLength={16}
              placeholder="비밀번호를 한 번 더 입력"
              aria-invalid={passwordMismatch}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
            {passwordMismatch && (
              <p className="text-xs text-destructive">비밀번호가 일치하지 않아요.</p>
            )}
          </div>

          {/* 닉네임 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="nickname" className="text-sm font-semibold text-foreground">
                닉네임
              </label>
              <Counter value={nickname.length} max={12} />
            </div>
            <Input
              id="nickname"
              value={nickname}
              maxLength={12}
              placeholder="채팅·모집글에 표시될 이름"
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          {/* 안내 박스 */}
          <div className="flex items-start gap-2.5 rounded-xl bg-primary-soft p-3.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-foreground">
              휴대전화·이메일 인증이 없어 비밀번호를 잊으면 계정을 복구할 수 없습니다.
            </p>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full rounded-xl text-base font-bold transition active:scale-[0.98]"
          >
            가입하기
          </Button>
        </div>
      </form>
    </>
  )
}
