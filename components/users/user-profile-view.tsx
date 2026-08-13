'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MessageCircle, ShieldAlert, UserPlus, UserX } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { MannerAvatar } from '@/components/manner-avatar'
import { MannerBadge } from '@/components/manner-badge'
import { MannerGauge } from '@/components/manner-gauge'
import { ReportModal } from '@/components/chat/report-modal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { blockUser, openDmWithFriend, respondToFriendRequest, sendFriendRequest, unblockUser } from '@/lib/api'
import { MANNER_TAG_META } from '@/lib/constants'
import type { FriendshipStatus, MannerProfile } from '@/lib/types'

export function UserProfileView({
  user,
  manner,
  completedPotCount,
  isSelf,
  friendship,
}: {
  user: { id: string; nickname: string }
  manner: MannerProfile
  completedPotCount: number
  isSelf: boolean
  friendship?: { status: FriendshipStatus; canRequest: boolean; requestId?: string }
}) {
  const router = useRouter()
  const [reportOpen, setReportOpen] = useState(false)
  const [friendState, setFriendState] = useState(friendship)
  const [busy, setBusy] = useState(false)

  async function handleSendRequest() {
    setBusy(true)
    try {
      const result = await sendFriendRequest(user.id)
      setFriendState((prev) => ({ ...prev, status: result.status === 'ACCEPTED' ? 'FRIEND' : 'PENDING_OUT', canRequest: false }))
    } catch (err) {
      alert(err instanceof Error ? err.message : '친구 신청에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAcceptRequest() {
    if (!friendState?.requestId) return
    setBusy(true)
    try {
      await respondToFriendRequest(friendState.requestId, 'accept')
      setFriendState((prev) => ({ ...prev, status: 'FRIEND' as FriendshipStatus, canRequest: false }))
    } finally {
      setBusy(false)
    }
  }

  async function handleMessage() {
    setBusy(true)
    try {
      const { roomId } = await openDmWithFriend(user.id)
      router.push(`/chat/${roomId}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '메시지를 시작할 수 없어요.')
      setBusy(false)
    }
  }

  async function handleBlock() {
    if (!confirm(`${user.nickname}님을 차단할까요? 차단하면 친구 관계도 함께 해제돼요.`)) return
    setBusy(true)
    try {
      await blockUser(user.id)
      setFriendState((prev) => ({ ...prev, status: 'BLOCKED_BY_ME' as FriendshipStatus, canRequest: false }))
    } finally {
      setBusy(false)
    }
  }

  async function handleUnblock() {
    setBusy(true)
    try {
      await unblockUser(user.id)
      setFriendState((prev) => ({ ...prev, status: 'NONE' as FriendshipStatus, canRequest: false }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AppHeader title="프로필" showBack />

      <div className="flex flex-col items-center gap-3 border-b border-border bg-card px-4 py-8">
        <MannerAvatar
          stage={manner.stage}
          color={manner.avatarColor}
          accessory={manner.avatarAccessory}
          className="size-16"
        />
        <p className="text-lg font-bold text-foreground">{user.nickname}</p>
        <MannerBadge
          stage={manner.stage}
          score={manner.score}
          reviewCount={manner.reviewCount}
          avatarColor={manner.avatarColor}
          avatarAccessory={manner.avatarAccessory}
        />
        {manner.topTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {manner.topTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {MANNER_TAG_META.GOOD[tag] ?? tag}
              </span>
            ))}
          </div>
        )}
        <MannerGauge score={manner.score} stage={manner.stage} className="w-full max-w-[220px]" />
      </div>

      <div className="flex flex-col gap-3 p-4">
        <Card className="flex items-center justify-between p-4">
          <span className="text-sm font-semibold text-muted-foreground">완료한 공동주문</span>
          <span className="text-base font-bold text-primary">{completedPotCount}회</span>
        </Card>

        {!isSelf && friendState && (
          <>
            {friendState.status === 'FRIEND' && (
              <div className="flex gap-2">
                <Button
                  onClick={handleMessage}
                  disabled={busy}
                  className="h-11 flex-1 gap-1.5 rounded-xl font-bold"
                >
                  <MessageCircle className="size-4" />
                  메시지 보내기
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBlock}
                  disabled={busy}
                  className="h-11 gap-1.5 rounded-xl font-bold text-destructive hover:text-destructive"
                >
                  차단
                </Button>
              </div>
            )}

            {friendState.status === 'PENDING_OUT' && (
              <Button disabled className="h-11 rounded-xl font-bold">
                친구 신청 대기 중
              </Button>
            )}

            {friendState.status === 'PENDING_IN' && (
              <Button
                onClick={handleAcceptRequest}
                disabled={busy}
                className="h-11 gap-1.5 rounded-xl font-bold"
              >
                <UserPlus className="size-4" />
                친구 신청 수락하기
              </Button>
            )}

            {friendState.status === 'NONE' && friendState.canRequest && (
              <Button
                onClick={handleSendRequest}
                disabled={busy}
                variant="outline"
                className="h-11 gap-1.5 rounded-xl font-bold"
              >
                <UserPlus className="size-4" />
                친구 신청
              </Button>
            )}

            {friendState.status === 'NONE' && !friendState.canRequest && (
              <p className="text-center text-xs text-muted-foreground">
                함께 참여한 공동주문이 있어야 친구 신청을 할 수 있어요.
              </p>
            )}

            {friendState.status === 'BLOCKED_BY_ME' && (
              <Button
                variant="outline"
                onClick={handleUnblock}
                disabled={busy}
                className="h-11 gap-1.5 rounded-xl font-bold"
              >
                <UserX className="size-4" />
                차단 해제
              </Button>
            )}
          </>
        )}

        {!isSelf && (
          <Button
            variant="outline"
            onClick={() => setReportOpen(true)}
            className="h-11 gap-1.5 rounded-xl font-bold text-destructive hover:text-destructive"
          >
            <ShieldAlert className="size-4" />
            신고하기
          </Button>
        )}
      </div>

      {!isSelf && (
        <ReportModal
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetNickname={user.nickname}
          reportedUserId={user.id}
        />
      )}
    </>
  )
}
