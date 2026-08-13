'use client'

import { ArrowLeft, Check, Clock, MapPin, Pencil, Share2, ShieldCheck, Smile, Trash2, Truck, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { InviteFriendsSheet } from '@/components/pots/invite-friends-sheet'
import { JoinButton } from '@/components/pots/join-button'
import { JoinConfirmSheet } from '@/components/pots/join-confirm-sheet'
import { PendingRequest, RequestList } from '@/components/pots/request-list'
import { MannerAvatar } from '@/components/manner-avatar'
import { ApprovalBadge, PotStatusBadge } from '@/components/status-badge'
import { StoreAvatar } from '@/components/store-avatar'
import { Progress } from '@/components/ui/progress'
import {
  cancelJoinPot,
  confirmPotComplete,
  decideMemberApplication,
  deletePot,
  requestJoinPot,
  updatePotStatus,
} from '@/lib/api'
import { zoneLabel } from '@/lib/constants'
import { getFoodEmoji } from '@/lib/food-emoji'
import { haversineDistanceMeters } from '@/lib/geo'
import { useUserCoords } from '@/lib/hooks/use-user-coords'
import { computeSplitCost } from '@/lib/split-cost'
import {
  formatDateTime,
  formatDeadline,
  formatDistance,
  formatWon,
} from '@/lib/format'
import type { MannerAvatarInfo, MannerReviewStatus, Participation, Pot, PotCompletionStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { ViewerState } from '@/types/pot-member'

export function PotDetailView({
  pot,
  participations,
  initialRequests = [],
  isHost,
  mannerReviewStatus,
  hostMenuAmount = 0,
  hostManner,
  completion,
}: {
  pot: Pot
  participations: Participation[]
  initialRequests?: PendingRequest[]
  isHost: boolean
  mannerReviewStatus?: MannerReviewStatus
  /** §5-4 분담 금액 계산용(P1) — 방장 본인의 참여 행에 담긴 주문 금액 */
  hostMenuAmount?: number
  /** 참여자 목록에 노출할 방장의 매너 아바타 정보(v2.13) */
  hostManner?: MannerAvatarInfo
  /** 거래 완료 확인 현황(먹튀 방지) — 모집 마감 후에만 채워진다 */
  completion?: PotCompletionStatus
}) {
  const router = useRouter()
  const [viewerState, setViewerState] = useState<ViewerState>(
    pot.viewerState ?? (isHost ? 'HOST' : 'JOINABLE'),
  )
  const [requests, setRequests] = useState<PendingRequest[]>(initialRequests)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)
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

  // §5-4 분담 금액(P1) — 확정 참여자가 있을 때만 계산해서 보여준다
  const splitCost =
    approved.length > 0
      ? computeSplitCost(
          [
            { userId: pot.hostId, nickname: pot.hostNickname, isHost: true, menuAmount: hostMenuAmount },
            ...approved.map((p) => ({ userId: p.userId, nickname: p.nickname, isHost: false, menuAmount: p.menuAmount })),
          ],
          pot.deliveryFee,
        )
      : []

  const userCoords = useUserCoords()
  const distanceMeters =
    userCoords && pot.pickupLat != null && pot.pickupLng != null
      ? haversineDistanceMeters(userCoords.lat, userCoords.lng, pot.pickupLat, pot.pickupLng)
      : null
  const pendingReviewCount = mannerReviewStatus?.eligible
    ? mannerReviewStatus.targets.filter((t) => !t.alreadyReviewed).length
    : 0

  async function handleJoinSubmit(menuMemo: string, menuAmount: number) {
    setLoading(true)
    try {
      await requestJoinPot(pot.id, menuMemo, menuAmount)
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

  async function handleConfirmComplete() {
    if (!confirm('정산까지 모두 끝났나요? 확인하면 되돌릴 수 없어요.')) return
    setConfirming(true)
    try {
      await confirmPotComplete(pot.id)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '거래 완료 확인에 실패했어요.')
    } finally {
      setConfirming(false)
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
        <div className="flex items-center">
          {isHost && pot.status === 'OPEN' && (
            <Link
              href={`/pots/${pot.id}/edit`}
              aria-label="수정"
              className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
            >
              <Pencil className="size-5" />
            </Link>
          )}
          <button
            type="button"
            onClick={handleShare}
            aria-label="공유"
            className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
          >
            {shared ? <Check className="size-5 text-status-ordered" /> : <Share2 className="size-5" />}
          </button>
        </div>
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

      {/* 거래 완료 확인(먹튀 방지) — 모집 마감 후, 아직 전원 확인이 안 됐을 때만 */}
      {completion && !completion.allConfirmed && completion.viewerIsMember && (
        <div className="mx-4 flex flex-col gap-2 rounded-xl bg-primary/10 px-4 py-3">
          <p className="text-sm font-semibold text-primary">
            정산까지 끝났다면 거래 완료를 확인해 주세요 ({completion.done}/{completion.total}명 확인)
          </p>
          {completion.viewerConfirmed ? (
            <p className="text-xs text-muted-foreground">확인 완료 · 다른 참여자를 기다리고 있어요.</p>
          ) : (
            <button
              type="button"
              onClick={handleConfirmComplete}
              disabled={confirming}
              className="flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
            >
              {confirming ? '확인하는 중...' : '거래 완료 확인'}
            </button>
          )}
        </div>
      )}

      {/* 매너평가 CTA — 주문 완료 후 아직 평가하지 않은 상대가 있을 때만 */}
      {pendingReviewCount > 0 && (
        <Link
          href={`/pots/${pot.id}/manner-review`}
          className="mx-4 flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition active:scale-[0.98]"
        >
          <span className="flex items-center gap-1.5">
            <Smile className="size-4" />
            함께한 메이트의 매너를 평가해 주세요 ({pendingReviewCount}명)
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

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
              {distanceMeters != null && (
                <p className="mt-0.5 text-xs font-medium text-primary">
                  현재 위치에서 {formatDistance(distanceMeters)}
                </p>
              )}
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
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Users className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-muted-foreground">
              참여자 {approved.length}명
            </h2>
          </div>
          {isHost && pot.status === 'OPEN' && (
            <button
              type="button"
              onClick={() => setShowInviteSheet(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <UserPlus className="size-3.5" />
              친구 초대
            </button>
          )}
        </div>

        <ul className="mt-3 flex flex-col gap-3">
          {/* 주최자 */}
          <li className="flex items-center gap-3">
            <MannerAvatar
              stage={hostManner?.stage ?? 'NEW'}
              color={hostManner?.avatarColor ?? 'NAVY'}
              accessory={hostManner?.avatarAccessory ?? 'NONE'}
              className="size-9"
            />
            <div className="min-w-0 flex-1">
              <Link href={`/users/${pot.hostId}`} className="text-sm font-semibold text-foreground hover:underline">
                {pot.hostNickname}
                <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-xs font-bold text-primary">
                  주최자
                </span>
              </Link>
            </div>
          </li>

          {(isHost ? participations : approved).map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <MannerAvatar
                stage={p.manner?.stage ?? 'NEW'}
                color={p.manner?.avatarColor ?? 'NAVY'}
                accessory={p.manner?.avatarAccessory ?? 'NONE'}
                className="size-9"
              />
              <div className="min-w-0 flex-1">
                <Link href={`/users/${p.userId}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                  {p.nickname}
                </Link>
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

        {isHost && (participations.length === 0 || pot.status === 'ORDERED') && (
          <div className="mt-4 flex flex-col gap-2">
            {pot.status === 'ORDERED' && (
              <p className="text-center text-xs text-muted-foreground">
                전원이 거래 완료를 확인했어요. 이제 모집글을 삭제할 수 있어요.
              </p>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/30 text-sm font-semibold text-destructive transition active:scale-[0.98] hover:bg-destructive/5 disabled:opacity-60"
            >
              <Trash2 className="size-4" />
              {deleting ? '삭제 중...' : '모집글 삭제'}
            </button>
          </div>
        )}
      </section>

      {/* 분담 금액 (§5-4, P1) */}
      {splitCost.length > 0 && (
        <section className="border-t border-border px-4 py-4">
          <div className="flex items-center gap-1.5">
            <Truck className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-muted-foreground">참여자별 예상 분담 금액</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            주문 금액은 각자 입력값 그대로, 배달비만 10원 단위로 올림해 나눠요. 나머지는 방장이 부담해요.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
            {splitCost.map((entry) => (
              <li key={entry.userId} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground">
                  <span className="truncate">{entry.nickname}</span>
                  {entry.isHost && (
                    <span className="shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      방장
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {formatWon(entry.menuAmount)} + 배달비 {formatWon(entry.deliveryShare)}
                  <span className="ml-1.5 font-bold text-foreground">{formatWon(entry.total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 하단 고정 CTA — 방장은 OPEN(모집 마감하기) 상태에서만. 마감 후엔 위쪽 거래완료
          확인 배너·삭제 버튼이 방장의 주 액션이라 여기서는 굳이 다시 노출하지 않는다 */}
      {(!isHost || pot.status === 'OPEN') && (
        <JoinButton
          potId={pot.id}
          viewerState={viewerState}
          loading={loading}
          onOpenConfirmSheet={() => setShowConfirmSheet(true)}
          onCancelRequest={handleCancelRequest}
          onHostAction={handleHostClose}
        />
      )}

      {/* 참여 신청 확인 시트 */}
      <JoinConfirmSheet
        isOpen={showConfirmSheet}
        onClose={() => setShowConfirmSheet(false)}
        onSubmit={handleJoinSubmit}
        deliveryFee={pot.deliveryFee}
      />

      {/* 친구 초대 시트 (§친구 기능) */}
      {isHost && (
        <InviteFriendsSheet
          isOpen={showInviteSheet}
          onClose={() => setShowInviteSheet(false)}
          potId={pot.id}
          excludeUserIds={[pot.hostId, ...participations.map((p) => p.userId)]}
        />
      )}
    </div>
  )
}
