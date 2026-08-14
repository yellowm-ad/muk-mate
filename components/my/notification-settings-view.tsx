'use client'

import { useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { Switch } from '@/components/ui/switch'
import { updatePreferences } from '@/lib/api'

export function NotificationSettingsView({
  initial,
}: {
  initial: { potNotificationsEnabled: boolean; friendNotificationsEnabled: boolean }
}) {
  const [potEnabled, setPotEnabled] = useState(initial.potNotificationsEnabled)
  const [friendEnabled, setFriendEnabled] = useState(initial.friendNotificationsEnabled)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(
    key: 'potNotificationsEnabled' | 'friendNotificationsEnabled',
    next: boolean,
    setLocal: (v: boolean) => void,
  ) {
    setLocal(next)
    setError(null)
    try {
      await updatePreferences({ [key]: next })
    } catch (err) {
      setLocal(!next)
      setError(err instanceof Error ? err.message : '저장에 실패했어요.')
    }
  }

  return (
    <>
      <AppHeader title="알림 설정" showBack />
      <div className="flex flex-col gap-3 p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">모집 활동 알림</span>
              <span className="text-xs text-muted-foreground">참여 신청·승인·거절·완료·초대</span>
            </div>
            <Switch
              checked={potEnabled}
              onCheckedChange={(v) => handleToggle('potNotificationsEnabled', v, setPotEnabled)}
            />
          </div>
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">친구 활동 알림</span>
              <span className="text-xs text-muted-foreground">친구 신청·수락</span>
            </div>
            <Switch
              checked={friendEnabled}
              onCheckedChange={(v) => handleToggle('friendNotificationsEnabled', v, setFriendEnabled)}
            />
          </div>
        </div>
      </div>
    </>
  )
}
