'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Users, X } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { ApprovalBadge, PotStatusBadge } from '@/components/status-badge'
import { StoreAvatar } from '@/components/store-avatar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { decideMemberApplication, updatePotStatus } from '@/lib/api'
import type { Participation, Pot, PotStatus } from '@/lib/types'

const STATUS_ACTIONS: Partial<Record<PotStatus, { label: string; next: PotStatus; variant: 'default' | 'destructive' }[]>> = {
  OPEN: [
    { label: '모집 마감하기', next: 'CLOSED', variant: 'default' },
    { label: '주문 취소하기', next: 'CANCELED', variant: 'destructive' },
  ],
  CLOSED: [
    { label: '주문 완료 처리', next: 'ORDERED', variant: 'default' },
    { label: '주문 취소하기', next: 'CANCELED', variant: 'destructive' },
  ],
}

export function PotApplicationsView({
  pot,
  participations,
}: {
  pot: Pot
  participations: Participation[]
}) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pending = participations.filter((p) => p.approvalStatus === 'PENDING')
  const approved = participations.filter((p) => p.approvalStatus === 'APPROVED')
  const rejected = participations.filter((p) => p.approvalStatus === 'REJECTED')

  async function handleDecision(participationId: string, userId: string, action: 'APPROVE' | 'REJECT') {
    setProcessingId(participationId)
    setError(null)
    try {
      await decideMemberApplication(pot.id, userId, action === 'APPROVE' ? 'approve' : 'reject')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했어요.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleStatusChange(next: PotStatus) {
    setError(null)
    try {
      await updatePotStatus(pot.id, next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했어요.')
    }
  }

  const statusActions = STATUS_ACTIONS[pot.status] ?? []

  return (
    <div className="flex flex-1 flex-col pb-8">
      <AppHeader title="참여 신청자 관리" showBack />

      <section className="flex items-center justify-between border-b border-border px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{pot.storeName}</p>
          <p className="text-xs text-muted-foreground">{pot.orderSummary}</p>
        </div>
        <PotStatusBadge status={pot.status} />
      </section>

      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {statusActions.length > 0 && (
        <section className="flex gap-2 border-b border-border px-4 py-4">
          {statusActions.map((action) => (
            <Button
              key={action.next}
              variant={action.variant === 'destructive' ? 'destructive' : 'default'}
              className="h-11 flex-1 rounded-xl text-sm font-bold"
              onClick={() => handleStatusChange(action.next)}
            >
              {action.label}
            </Button>
          ))}
        </section>
      )}

      {participations.length === 0 ? (
        <EmptyState
          icon={Users}
          title="아직 신청자가 없어요"
          description="공동주문이 공유되면 신청이 들어올 거예요."
        />
      ) : (
        <div className="flex flex-col gap-5 px-4 py-4">
          {pending.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-muted-foreground">
                승인 대기 {pending.length}건
              </h2>
              <ul className="flex flex-col gap-2.5">
                {pending.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <StoreAvatar name={p.nickname} className="size-9 text-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{p.nickname}</p>
                        {p.applyMessage && (
                          <p className="truncate text-xs text-muted-foreground">{p.applyMessage}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-10 flex-1 gap-1.5 rounded-lg text-sm font-semibold"
                        disabled={processingId === p.id}
                        onClick={() => handleDecision(p.id, p.userId, 'REJECT')}
                      >
                        <X className="size-4" />
                        거절
                      </Button>
                      <Button
                        className="h-10 flex-1 gap-1.5 rounded-lg text-sm font-semibold"
                        disabled={processingId === p.id}
                        onClick={() => handleDecision(p.id, p.userId, 'APPROVE')}
                      >
                        <Check className="size-4" />
                        승인
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {approved.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-muted-foreground">
                승인됨 {approved.length}명
              </h2>
              <ul className="flex flex-col gap-2">
                {approved.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-2.5">
                    <StoreAvatar name={p.nickname} className="size-8 text-xs" />
                    <span className="flex-1 truncate text-sm font-medium text-foreground">{p.nickname}</span>
                    <ApprovalBadge status={p.approvalStatus} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rejected.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-muted-foreground">
                거절됨 {rejected.length}명
              </h2>
              <ul className="flex flex-col gap-2">
                {rejected.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-2.5 opacity-60"
                  >
                    <StoreAvatar name={p.nickname} className="size-8 text-xs" />
                    <span className="flex-1 truncate text-sm font-medium text-foreground">{p.nickname}</span>
                    <ApprovalBadge status={p.approvalStatus} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
