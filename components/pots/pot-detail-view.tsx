'use client'

import { ArrowLeft, Check, Clock, MapPin, Share2, ShieldCheck, Trash2, Truck, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { JoinButton } from '@/components/pots/join-button'
import { JoinConfirmSheet } from '@/components/pots/join-confirm-sheet'
import { PendingRequest, RequestList } from '@/components/pots/request-list'
import { ApprovalBadge, PotStatusBadge } from '@/components/status-badge'
import { StoreAvatar } from '@/components/store-avatar'
import { Progress } from '@/components/ui/progress'
import { cancelJoinPot, decideMemberApplication, deletePot, requestJoinPot, updatePotStatus } from '@/lib/api'
import { zoneLabel } from '@/lib/constants'
import { getFoodEmoji } from '@/lib/food-emoji'
import {
  formatDateTime,
  formatDeadline,
  formatDistance,
  formatWon,
} from '@/lib/format'
import type { Participation, Pot } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { ViewerState } from '@/types/pot-member'

export function PotDetailView({
  pot,
  participations,
  initialRequests = [],
  isHost,
}: {
  pot: Pot
  participations: Participation[]
  initialRequests?: PendingRequest[]
  isHost: boolean
}) {
  const router = useRouter()
  const [viewerState, setViewerState] = useState<ViewerState>(
    pot.viewerState ?? (isHost ? 'HOST' : 'JOINABLE'),
  )
  const [requests, setRequests] = useState<PendingRequest[]>(initialRequests)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shared, setShared] = useState(false)

  const deadline = formatDeadline(pot.deadlineAt)
  const isAmount = pot.targetType === 'AMOUNT'
  const amount = pot.currentAmount ?? 0
  const approvedCount = pot.approvedCount ?? pot.currentCount
  const isFull = approvedCount >= pot.targetValue

  const progress = isAmount
    ? Math.min((amount / pot.targetValue) * 100, 100)
    : Math.min((approvedCount / pot.targetValue) * 100, 100)

  const approved = participations.filter((p) => p.approvalStatus === 'APPROVED')

  async function handleJoinSubmit(menuMemo: string) {
    setLoading(true)
    try {
      await requestJoinPot(pot.id, menuMemo)
      setViewerState('PENDING')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelRequest() {
    setLoading(true)
    try {
      await cancelJoinPot(pot.id)
      setViewerState('JOINABLE')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveRequest(userId: string) {
    await decideMemberApplication(pot.id, userId, 'approve')
    setRequests((prev) => prev.filter((r) => r.userId !== userId))
    router.refresh()
  }

  async function handleRejectRequest(userId: string) {
    await decideMemberApplication(pot.id, userId, 'reject')
    setRequests((prev) => prev.filter((r) => r.userId !== userId))
    router.refresh()
  }

  async function handleHostClose() {
    if (confirm('모집을 마감하시겠습니까?')) {
      setLoading(true)
      try {
        await updatePotStatus(pot.id, 'CLOSED')
        router.refresh()
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleDelete() {
    if (!confirm('모집글을 삭제하시겠습니까? 삭제하면 되돌릴 수 없어요.')) return
    setDeleting(true)
    try {
      await deletePot(pot.id)
      router.push('/pots')
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했어요.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: `${pot.storeName} 공동주문`, url })
      } catch {
        // 사용자가 공유 시트를 취소한 경우 등 — 무시
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      alert('링크 복사에 실패했어요.')
    }
  }

  return (
    <div className="flex flex-1 flex-col pb-28">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-1 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로"
          className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="text-base font-bold text-foreground">공동주문 상세</span>
        <button
          type="button"
          onClick={handleShare}
          aria-label="공유"
          className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
        >
          {shared ? <Check className="size-5 text-status-ordered" /> : <Share2 className="size-5" />}
        </button>
      </header>

      {/* 가게/상태 */}
      <section className="flex items-start gap-3 px-4 py-4">
        <StoreAvatar
          name={pot.storeName}
          emoji={getFoodEmoji(pot.orderSummary, pot.storeName)}
          className="size-14 text-2xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PotStatusBadge status={pot.status} />
            {pot.isLocationVerified && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-status-ordered/12 px-2 text-xs font-semibold text-status-ordered">
                <ShieldCheck className="size-3.5" />
                위치확인
              </span>
            )}
          </div>
          <h1 className="mt-1.5 text-lg font-bold text-foreground text-balance">{pot.storeName}</h1>
          <p className="text-sm text-muted-foreground">{zoneLabel(pot.zoneCode)}</p>
        </div>
      </section>

      {/* 방장용 참여 신청 목록 섹션 */}
      {isHost && (
        <RequestList
          requests={requests}
          isFull={isFull}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
        />
      )}

      {/* 주문 내용 */}
      <section className="border-t border-border px-4 py-4">
        <h2 className="text-sm font-bold text-muted-foreground">주문 내용</h2>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
          {pot.orderSummary}
        </p>
        {pot.extraNote && (
          <p className="mt-2 rounded-xl bg-muted px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
            {pot.extraNote}
          </p>
        )}
      </section>

      {/* 모집 현황 */}
      <section className="border-t border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground">모집 현황</h2>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-sm font-semibold',
              deadline.urgent ? 'text-destructive' : 'text-foreground',
            )}
          >
            <Clock className="size-4" />
            {deadline.text}
          </span>
        </div>

        <div className="mt-3">
          <div className="flex items-end justify-between">
            {isAmount ? (
              <span className="text-lg font-bold tabular-nums text-foreground">
                {formatWon(amount)}
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  / {formatWon(pot.targetValue)}
                </span>
              </span>
            ) : (
              <span className="text-lg font-bold tabular-nums text-foreground">
                {approvedCount}명
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  / {pot.targetValue}명
                </span>
              </span>
            )}
            <span className="text-sm font-semibold text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="mt-2 h-2.5" />
        </div>
      </section>

      {/* 수령 정보 */}
      <section className="border-t border-border px-4 py-4">
        <h2 className="text-sm font-bold text-muted-foreground">수령 정보</h2>
        <ul className="mt-2 flex flex-col gap-3">
          <li className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-[15px] font-semibold text-foreground">{pot.pickupName}</p>
              <p className="text-sm text-muted-foreground">{pot.pickupAddress}</p>
              {pot.pickupNote && (
                <p className="mt-0.5 text-sm text-muted-foreground">{pot.pickupNote}</p>
              )}
              <p className="mt-0.5 text-xs font-medium text-primary">
                현재 위치에서 {formatDistance(pot.distanceMeters)}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-[15px] font-semibold text-foreground">수령 시간</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(pot.pickupAt)}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <Truck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-[15px] font-semibold text-foreground">배달비 분담</p>
              <p className="text-sm text-muted-foreground">
                총 {formatWon(pot.deliveryFee)} · 참여 인원으로 나눠서 부담해요
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* 참여자 */}
      <section className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-1.5">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-muted-foreground">
            참여자 {approved.length}명
          </h2>
        </div>

        <ul className="mt-3 flex flex-col gap-3">
          {/* 주최자 */}
          <li className="flex items-center gap-3">
            <StoreAvatar name={pot.hostNickname} className="size-9 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {pot.hostNickname}
                <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-xs font-bold text-primary">
                  주최자
                </span>
              </p>
            </div>
          </li>

          {(isHost ? participations : approved).map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <StoreAvatar name={p.nickname} className="size-9 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{p.nickname}</p>
                {p.applyMessage && (
                  <p className="truncate text-xs text-muted-foreground">{p.applyMessage}</p>
                )}
              </div>
              {isHost && <ApprovalBadge status={p.approvalStatus} />}
            </li>
          ))}

          {approved.length === 0 && !isHost && (
            <li className="rounded-xl bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
              아직 참여자가 없어요. 첫 번째로 참여해보세요!
            </li>
          )}
        </ul>

        {isHost && participations.length === 0 && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/30 text-sm font-semibold text-destructive transition active:scale-[0.98] hover:bg-destructive/5 disabled:opacity-60"
          >
            <Trash2 className="size-4" />
            {deleting ? '삭제 중...' : '모집글 삭제'}
          </button>
        )}
      </section>

      {/* 하단 고정 CTA */}
      <JoinButton
        potId={pot.id}
        viewerState={viewerState}
        loading={loading}
        onOpenConfirmSheet={() => setShowConfirmSheet(true)}
        onCancelRequest={handleCancelRequest}
        onHostAction={handleHostClose}
      />

      {/* 참여 신청 확인 시트 */}
      <JoinConfirmSheet
        isOpen={showConfirmSheet}
        onClose={() => setShowConfirmSheet(false)}
        onSubmit={handleJoinSubmit}
      />
    </div>
  )
}
