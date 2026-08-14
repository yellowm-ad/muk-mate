'use client'

import { useState } from 'react'
import { UserX } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { MannerAvatar } from '@/components/manner-avatar'
import { Switch } from '@/components/ui/switch'
import { unblockUser, updatePreferences } from '@/lib/api'
import type { FriendSummary } from '@/lib/types'

export function FriendSettingsView({
  initialBlocked,
  initialAutoAccept,
}: {
  initialBlocked: FriendSummary[]
  initialAutoAccept: boolean
}) {
  const [blocked, setBlocked] = useState(initialBlocked)
  const [autoAccept, setAutoAccept] = useState(initialAutoAccept)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAutoAcceptToggle(next: boolean) {
    setAutoAccept(next)
    setError(null)
    try {
      await updatePreferences({ autoAcceptFriendRequests: next })
    } catch (err) {
      setAutoAccept(!next)
      setError(err instanceof Error ? err.message : '저장에 실패했어요.')
    }
  }

  async function handleUnblock(userId: string) {
    setBusyId(userId)
    try {
      await unblockUser(userId)
      setBlocked((prev) => prev.filter((b) => b.userId !== userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '차단 해제에 실패했어요.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <AppHeader title="친구 설정" showBack />
      <div className="flex flex-col gap-3 p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex h-16 items-center justify-between rounded-2xl border border-border bg-card px-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">친구 신청 자동수락</span>
            <span className="text-xs text-muted-foreground">확인 없이 바로 친구가 돼요</span>
          </div>
          <Switch checked={autoAccept} onCheckedChange={handleAutoAcceptToggle} />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold text-muted-foreground">차단 목록</h2>
          {blocked.length === 0 ? (
            <EmptyState icon={UserX} title="차단한 사용자가 없어요" />
          ) : (
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {blocked.map((b) => (
                <div key={b.userId} className="flex items-center gap-3 px-4 py-3">
                  <MannerAvatar
                    stage={b.manner?.stage ?? 'NEW'}
                    color={b.manner?.avatarColor ?? 'NAVY'}
                    accessory={b.manner?.avatarAccessory ?? 'NONE'}
                    className="size-9 shrink-0"
                  />
                  <span className="flex-1 truncate text-sm font-semibold text-foreground">{b.nickname}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === b.userId}
                    onClick={() => handleUnblock(b.userId)}
                  >
                    차단 해제
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
