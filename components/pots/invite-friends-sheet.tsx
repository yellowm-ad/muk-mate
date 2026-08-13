'use client'

import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'

import { MannerAvatar } from '@/components/manner-avatar'
import { Button } from '@/components/ui/button'
import { getFriends, invitePotFriends } from '@/lib/api'
import type { FriendSummary } from '@/lib/types'

export function InviteFriendsSheet({
  isOpen,
  onClose,
  potId,
  /** 이미 참여(신청 포함) 중인 유저 id — 선택 목록에서 제외 */
  excludeUserIds,
}: {
  isOpen: boolean
  onClose: () => void
  potId: string
  excludeUserIds: string[]
}) {
  const [friends, setFriends] = useState<FriendSummary[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitedCount, setInvitedCount] = useState<number | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setInvitedCount(null)
    setSelected(new Set())
    getFriends()
      .then(setFriends)
      .catch(() => setError('친구 목록을 불러오지 못했어요.'))
  }, [isOpen])

  if (!isOpen) return null

  const excludeSet = new Set(excludeUserIds)
  const invitable = (friends ?? []).filter((f) => !excludeSet.has(f.userId))

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const { invitedCount } = await invitePotFriends(potId, [...selected])
      setInvitedCount(invitedCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대에 실패했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-[430px] flex-col rounded-t-2xl bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-foreground">친구 초대하기</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          초대하면 친구에게 알림이 가요. 참여는 평소처럼 신청 후 승인 절차를 거쳐요.
        </p>

        {invitedCount !== null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              {invitedCount > 0 ? `친구 ${invitedCount}명에게 초대를 보냈어요.` : '초대를 보낼 친구를 선택해 주세요.'}
            </p>
            <Button onClick={onClose} className="mt-3 h-11 rounded-xl px-8 font-bold">
              닫기
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <p className="mt-3 rounded-lg bg-destructive/10 p-2.5 text-xs font-medium text-destructive">{error}</p>
            )}

            <div className="mt-3 flex-1 overflow-y-auto">
              {friends === null ? (
                <p className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</p>
              ) : invitable.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  초대할 수 있는 친구가 없어요. 함께한 공동주문 상대에게 먼저 친구 신청을 해보세요.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {invitable.map((f) => (
                    <li key={f.userId}>
                      <label className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={selected.has(f.userId)}
                          onChange={() => toggle(f.userId)}
                          className="size-4 accent-primary"
                        />
                        <MannerAvatar
                          stage={f.manner?.stage ?? 'NEW'}
                          color={f.manner?.avatarColor ?? 'NAVY'}
                          accessory={f.manner?.avatarAccessory ?? 'NONE'}
                          className="size-8"
                        />
                        <span className="text-sm font-semibold text-foreground">{f.nickname}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="h-12 flex-1 rounded-xl text-base font-bold">
                취소
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || selected.size === 0}
                className="h-12 flex-1 gap-1.5 rounded-xl text-base font-bold"
              >
                <UserPlus className="size-4" />
                {submitting ? '초대하는 중...' : `초대하기${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
