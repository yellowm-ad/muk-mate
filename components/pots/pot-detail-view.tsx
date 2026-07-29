"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, Clock, MapPin, Share2, ShieldCheck, Truck, Users } from "lucide-react"
import { StoreAvatar } from "@/components/store-avatar"
import { PotStatusBadge, ApprovalBadge } from "@/components/status-badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  formatDateTime,
  formatDeadline,
  formatDistance,
  formatWon,
} from "@/lib/format"
import { zoneLabel } from "@/lib/constants"
import type { Participation, Pot } from "@/lib/types"
import { cn } from "@/lib/utils"

export function PotDetailView({
  pot,
  participations,
  isHost,
}: {
  pot: Pot
  participations: Participation[]
  isHost: boolean
}) {
  const router = useRouter()
  const [applied, setApplied] = useState(false)

  const deadline = formatDeadline(pot.deadlineAt)
  const isAmount = pot.targetType === "AMOUNT"
  const amount = pot.currentAmount ?? 0
  const progress = isAmount
    ? Math.min((amount / pot.targetValue) * 100, 100)
    : Math.min((pot.currentCount / pot.targetValue) * 100, 100)
  const approved = participations.filter((p) => p.approvalStatus === "APPROVED")
  const canApply = pot.status === "OPEN" && !deadline.expired && !isHost

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
          aria-label="공유"
          className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
        >
          <Share2 className="size-5" />
        </button>
      </header>

      {/* 가게/상태 */}
      <section className="flex items-start gap-3 px-4 py-4">
        <StoreAvatar name={pot.storeName} className="size-14 text-xl" />
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
              "inline-flex items-center gap-1 text-sm font-semibold",
              deadline.urgent ? "text-destructive" : "text-foreground",
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
                {pot.currentCount}명
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
      </section>

      {/* 하단 고정 CTA */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div className="pointer-events-auto mx-auto max-w-[430px] border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          {isHost ? (
            <Button
              className="h-12 w-full rounded-xl text-base font-bold"
              onClick={() => router.push(`/pots/${pot.id}/applications`)}
            >
              신청자 관리 ({participations.filter((p) => p.approvalStatus === "PENDING").length})
            </Button>
          ) : canApply ? (
            <Button
              className="h-12 w-full rounded-xl text-base font-bold"
              disabled={applied}
              onClick={() => setApplied(true)}
            >
              {applied ? "신청 완료 — 승인 대기중" : "참여 신청하기"}
            </Button>
          ) : (
            <Button className="h-12 w-full rounded-xl text-base font-bold" disabled>
              {deadline.expired ? "마감된 공동주문이에요" : "참여할 수 없어요"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
