'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { UserCheck, Users } from 'lucide-react'

import { AppHeader } from '@/components/app-header'
import { MannerAvatar } from '@/components/manner-avatar'
import { Button } from '@/components/ui/button'
import { removeFriend, respondToFriendRequest } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { FriendRequestSummary, FriendSummary } from '@/lib/types'

export function FriendsView({
  initialFriends,
  initialRequests,
}: {
  initialFriends: FriendSummary[]
  initialRequests: FriendRequestSummary[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'FRIENDS' | 'REQUESTS'>('FRIENDS')
  const [friends, setFriends] = useState(initialFriends)
  const [requests, setRequests] = useState(initialRequests)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleRemove(userId: string, friendRequestId: string) {
    if (!confirm('이 친구를 삭제할까요? 삭제해도 메시지는 계속 주고받을 수 있어요.')) return
    setBusyId(friendRequestId)
    try {
      await removeFriend(userId)
      setFriends((prev) => prev.filter((f) => f.friendRequestId !== friendRequestId))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRespond(requestId: string, action: 'accept' | 'reject') {
    setBusyId(requestId)
    try {
      await respondToFriendRequest(requestId, action)
      setRequests((prev) => prev.filter((r) => r.requestId !== requestId))
      if (action === 'accept') router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <AppHeader title="친구" showBack />

      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab('FRIENDS')}
          className={cn(
            'flex-1 border-b-2 py-3 text-sm font-bold transition',
            tab === 'FRIENDS' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
          )}
        >
          친구 목록{friends.length > 0 && ` (${friends.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab('REQUESTS')}
          className={cn(
            'flex-1 border-b-2 py-3 text-sm font-bold transition',
            tab === 'REQUESTS' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
          )}
        >
          친구 신청{requests.length > 0 && ` (${requests.length})`}
        </button>
      </div>

      {tab === 'FRIENDS' ? (
        friends.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8 text-muted-foreground" />}
            text="아직 친구가 없어요."
            hint="공동주문에서 함께한 사람의 프로필에서 친구 신청을 보내보세요."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {friends.map((f) => (
              <li key={f.friendRequestId} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/users/${f.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <MannerAvatar
                    stage={f.manner?.stage ?? 'NEW'}
                    color={f.manner?.avatarColor ?? 'NAVY'}
                    accessory={f.manner?.avatarAccessory ?? 'NONE'}
                    className="size-10"
                  />
                  <span className="truncate text-sm font-semibold text-foreground">{f.nickname}</span>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === f.friendRequestId}
                  onClick={() => handleRemove(f.userId, f.friendRequestId)}
                  className="h-8 shrink-0 rounded-lg text-xs font-semibold text-muted-foreground"
                >
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : requests.length === 0 ? (
        <EmptyState icon={<UserCheck className="size-8 text-muted-foreground" />} text="받은 친구 신청이 없어요." />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {requests.map((r) => (
            <li key={r.requestId} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/users/${r.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <MannerAvatar
                  stage={r.manner?.stage ?? 'NEW'}
                  color={r.manner?.avatarColor ?? 'NAVY'}
                  accessory={r.manner?.avatarAccessory ?? 'NONE'}
                  className="size-10"
                />
                <span className="truncate text-sm font-semibold text-foreground">{r.nickname}</span>
              </Link>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === r.requestId}
                  onClick={() => handleRespond(r.requestId, 'reject')}
                  className="h-8 rounded-lg text-xs font-semibold"
                >
                  거절
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === r.requestId}
                  onClick={() => handleRespond(r.requestId, 'accept')}
                  className="h-8 rounded-lg text-xs font-bold"
                >
                  수락
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function EmptyState({ icon, text, hint }: { icon: React.ReactNode; text: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      {icon}
      <p className="text-sm font-semibold text-foreground">{text}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
