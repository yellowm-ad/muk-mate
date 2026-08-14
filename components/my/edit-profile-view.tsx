'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { Check, GraduationCap, Loader2, MapPin } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ZONES } from '@/lib/constants'
import {
  changeLoginId,
  changePassword,
  requestLoginIdChangeCode,
  updateProfile,
  verifyLoginIdChangeCode,
  withdrawAccount,
} from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import type { ZoneCode } from '@/lib/types'
import { cn } from '@/lib/utils'

const LOGIN_ID_MIN = 4
const LOGIN_ID_MAX = 10
const RESEND_COOLDOWN_SEC = 60

export function EditProfileView({
  me,
  jbnuEmail,
}: {
  me: { nickname: string; zoneCode: ZoneCode }
  jbnuEmail: { email: string; verifiedAt: string } | null
}) {
  const router = useRouter()
  const { update } = useSession()

  const [nickname, setNickname] = useState(me.nickname)
  const [zoneCode, setZoneCode] = useState<ZoneCode>(me.zoneCode)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)

  const [newLoginId, setNewLoginId] = useState('')
  const [loginIdCode, setLoginIdCode] = useState('')
  const [loginIdPhase, setLoginIdPhase] = useState<'input' | 'sent' | 'verified'>('input')
  const [loginIdCurrentPassword, setLoginIdCurrentPassword] = useState('')
  const [requestingLoginIdCode, setRequestingLoginIdCode] = useState(false)
  const [verifyingLoginIdCode, setVerifyingLoginIdCode] = useState(false)
  const [changingLoginId, setChangingLoginId] = useState(false)
  const [loginIdError, setLoginIdError] = useState<string | null>(null)
  const [loginIdResendCooldownSec, setLoginIdResendCooldownSec] = useState(0)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const [withdrawPassword, setWithdrawPassword] = useState('')
  const [withdrawSaving, setWithdrawSaving] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  const passwordMismatch = newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError(null)
    setProfileSaved(false)
    try {
      const updated = await updateProfile({ nickname: nickname.trim(), zoneCode })
      // JWT 세션은 DB를 다시 안 읽으므로, 재로그인 없이 화면에 바로 반영하려면
      // useSession().update()로 토큰을 직접 갱신해야 한다 (auth.ts의 jwt 콜백 참고).
      await update({ nickname: updated.nickname, zoneCode: updated.zoneCode })
      setProfileSaved(true)
      router.refresh()
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : '저장에 실패했어요.')
    } finally {
      setProfileSaving(false)
    }
  }

  useEffect(() => {
    if (loginIdResendCooldownSec <= 0) return
    const t = setTimeout(() => setLoginIdResendCooldownSec((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [loginIdResendCooldownSec])

  async function handleRequestLoginIdCode() {
    setRequestingLoginIdCode(true)
    setLoginIdError(null)
    try {
      await requestLoginIdChangeCode()
      setLoginIdPhase('sent')
      setLoginIdResendCooldownSec(RESEND_COOLDOWN_SEC)
    } catch (err) {
      setLoginIdError(err instanceof Error ? err.message : '인증번호 발송에 실패했어요.')
    } finally {
      setRequestingLoginIdCode(false)
    }
  }

  async function handleVerifyLoginIdCode() {
    if (loginIdCode.length === 0) return
    setVerifyingLoginIdCode(true)
    setLoginIdError(null)
    try {
      await verifyLoginIdChangeCode(loginIdCode)
      setLoginIdPhase('verified')
    } catch (err) {
      setLoginIdError(err instanceof Error ? err.message : '인증번호 확인에 실패했어요.')
    } finally {
      setVerifyingLoginIdCode(false)
    }
  }

  async function handleChangeLoginIdSubmit(e: React.FormEvent) {
    e.preventDefault()
    setChangingLoginId(true)
    setLoginIdError(null)
    try {
      await changeLoginId({ code: loginIdCode, newLoginId, currentPassword: loginIdCurrentPassword })
      alert('아이디가 변경됐어요. 새 아이디로 다시 로그인해 주세요.')
      await fetch('/api/auth/session-guard', { method: 'DELETE' })
      await signOut({ callbackUrl: '/login' })
    } catch (err) {
      setLoginIdError(err instanceof Error ? err.message : '아이디 변경에 실패했어요.')
      setChangingLoginId(false)
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    if (!withdrawPassword) return
    if (
      !confirm(
        '정말 탈퇴하시겠습니까?\n\n로그인이 불가능해지고, 호스트 중인 모집중인 주문은 자동으로 취소되어 참여자에게 알림이 갑니다. 기존 채팅 기록·참여 이력은 다른 사용자를 위해 남아있지만 닉네임은 "탈퇴한 사용자"로 표시됩니다.',
      )
    ) {
      return
    }
    setWithdrawSaving(true)
    setWithdrawError(null)
    try {
      await withdrawAccount(withdrawPassword)
      await fetch('/api/auth/session-guard', { method: 'DELETE' })
      await signOut({ callbackUrl: '/login' })
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : '탈퇴에 실패했어요.')
      setWithdrawSaving(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (passwordMismatch) return
    setPasswordSaving(true)
    setPasswordError(null)
    setPasswordSaved(false)
    try {
      await changePassword({ currentPassword, newPassword })
      setPasswordSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '변경에 실패했어요.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <>
      <AppHeader title="기본정보·비밀번호 수정" showBack />

      <div className="flex flex-col gap-6 p-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-1.5 font-bold text-foreground">
            <GraduationCap className="size-4" /> 학교 인증
          </h2>
          {jbnuEmail ? (
            <p className="text-sm text-muted-foreground">
              전북대 이메일 인증됨 — <span className="font-semibold text-foreground">{jbnuEmail.email}</span>
              <br />
              <span className="text-xs">{formatDateTime(jbnuEmail.verifiedAt)} 인증</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              전북대 이메일이 연동되어 있지 않아요. 이 계정은 회원가입 때 전북대 이메일 인증을 도입하기 전에
              가입했어요.
            </p>
          )}
        </div>

        <form
          onSubmit={handleProfileSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <h2 className="font-bold text-foreground">기본정보</h2>

          {profileError && <p className="text-sm text-destructive">{profileError}</p>}
          {profileSaved && <p className="text-sm text-status-ordered">저장했어요.</p>}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">닉네임</label>
            <Input
              value={nickname}
              maxLength={12}
              onChange={(e) => setNickname(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">활동 지역</label>
            <div className="grid grid-cols-2 gap-2">
              {ZONES.map((z) => (
                <button
                  key={z.code}
                  type="button"
                  onClick={() => setZoneCode(z.code)}
                  className={cn(
                    'flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition',
                    zoneCode === z.code
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <MapPin className="size-3.5" />
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={profileSaving || !nickname.trim()}
            className="h-11 w-full rounded-xl font-bold"
          >
            {profileSaving ? '저장하는 중...' : '기본정보 저장'}
          </Button>
        </form>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-bold text-foreground">아이디 변경</h2>

          {!jbnuEmail ? (
            <p className="text-sm text-muted-foreground">
              전북대 이메일이 연동되지 않아 아이디를 변경할 수 없어요.
            </p>
          ) : (
            <form onSubmit={handleChangeLoginIdSubmit} className="flex flex-col gap-3">
              {loginIdError && <p className="text-sm text-destructive">{loginIdError}</p>}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">새 아이디 ({LOGIN_ID_MIN}~{LOGIN_ID_MAX}자)</label>
                <Input
                  value={newLoginId}
                  maxLength={LOGIN_ID_MAX}
                  onChange={(e) => setNewLoginId(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  이메일 인증 ({jbnuEmail.email})
                </label>
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="인증번호 6자리"
                    value={loginIdCode}
                    disabled={loginIdPhase === 'verified'}
                    onChange={(e) => setLoginIdCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="h-11 rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={requestingLoginIdCode || loginIdPhase === 'verified' || loginIdResendCooldownSec > 0}
                    onClick={handleRequestLoginIdCode}
                    className="h-11 shrink-0 gap-1.5 rounded-xl px-3 text-sm font-semibold"
                  >
                    {requestingLoginIdCode && <Loader2 className="size-3.5 animate-spin" />}
                    {loginIdPhase === 'input'
                      ? '인증번호 받기'
                      : loginIdResendCooldownSec > 0
                        ? `재전송 ${loginIdResendCooldownSec}s`
                        : '재전송'}
                  </Button>
                  <Button
                    type="button"
                    disabled={verifyingLoginIdCode || loginIdPhase !== 'sent' || loginIdCode.length === 0}
                    onClick={handleVerifyLoginIdCode}
                    className="h-11 shrink-0 gap-1.5 rounded-xl px-3 text-sm font-semibold"
                  >
                    {verifyingLoginIdCode && <Loader2 className="size-3.5 animate-spin" />}
                    확인
                  </Button>
                </div>
                {loginIdPhase === 'verified' && (
                  <p className="flex items-center gap-1 text-xs text-status-ordered">
                    <Check className="size-3.5" /> 인증 완료
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">현재 비밀번호</label>
                <Input
                  type="password"
                  value={loginIdCurrentPassword}
                  onChange={(e) => setLoginIdCurrentPassword(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              <Button
                type="submit"
                disabled={
                  changingLoginId ||
                  loginIdPhase !== 'verified' ||
                  newLoginId.length < LOGIN_ID_MIN ||
                  !loginIdCurrentPassword
                }
                className="h-11 w-full rounded-xl font-bold"
              >
                {changingLoginId ? '변경하는 중...' : '아이디 변경'}
              </Button>
            </form>
          )}
        </div>

        <form
          onSubmit={handlePasswordSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <h2 className="font-bold text-foreground">비밀번호 변경</h2>

          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          {passwordSaved && <p className="text-sm text-status-ordered">비밀번호를 변경했어요.</p>}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">현재 비밀번호</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">새 비밀번호 (4~16자)</label>
            <Input
              type="password"
              value={newPassword}
              maxLength={16}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">새 비밀번호 확인</label>
            <Input
              type="password"
              value={newPasswordConfirm}
              maxLength={16}
              aria-invalid={passwordMismatch}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className="h-11 rounded-xl"
            />
            {passwordMismatch && <p className="text-xs text-destructive">비밀번호가 일치하지 않아요.</p>}
          </div>

          <Button
            type="submit"
            disabled={passwordSaving || !currentPassword || newPassword.length < 4 || passwordMismatch}
            className="h-11 w-full rounded-xl font-bold"
          >
            {passwordSaving ? '변경하는 중...' : '비밀번호 변경'}
          </Button>
        </form>

        <form
          onSubmit={handleWithdraw}
          className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-4 shadow-sm"
        >
          <h2 className="font-bold text-destructive">회원 탈퇴</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            탈퇴하면 로그인이 불가능해져요. 호스트 중인 모집중인 주문은 자동으로 취소되어 참여자에게
            알림이 가고, 기존 채팅 기록·참여 이력은 다른 사용자를 위해 남지만 닉네임은 "탈퇴한
            사용자"로 표시돼요.
          </p>

          {withdrawError && <p className="text-sm text-destructive">{withdrawError}</p>}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">현재 비밀번호</label>
            <Input
              type="password"
              value={withdrawPassword}
              onChange={(e) => setWithdrawPassword(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            variant="destructive"
            disabled={withdrawSaving || !withdrawPassword}
            className="h-11 w-full rounded-xl font-bold"
          >
            {withdrawSaving ? '탈퇴 처리 중...' : '회원 탈퇴'}
          </Button>
        </form>
      </div>
    </>
  )
}
