'use client'

import { useState } from 'react'
import { StoreAvatar } from '@/components/store-avatar'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'

export interface PendingRequest {
  userId: string
  nickname: string
  menuMemo: string
  requestedAt: string
}

interface RequestListProps {
  requests: PendingRequest[]
  isFull: boolean
  onApprove: (userId: string) => Promise<void>
  onReject: (userId: string) => Promise<void>
}

export function RequestList({ requests, isFull, onApprove, onReject }: RequestListProps) {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!requests || requests.length === 0) {
    return null
  }

  async function handleApprove(userId: string) {
    setProcessingUserId(userId)
    setError(null)
    try {
      await onApprove(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '수락 처리에 실패했습니다.')
    } finally {
      setProcessingUserId(null)
    }
  }

  async function handleReject(userId: string) {
    setProcessingUserId(userId)
    setError(null)
    try {
      await onReject(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '거절 처리에 실패했습니다.')
    } finally {
      setProcessingUserId(null)
    }
  }

  return (
    <section className="border-t border-border px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">
          참여 신청 <span className="text-primary">{requests.length}건</span>
        </h2>
        {isFull && (
          <span className="text-xs font-semibold text-destructive">인원이 다 찼어요</span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {requests.map((req) => {
          const isProcessing = processingUserId === req.userId
          return (
            <li
              key={req.userId}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <StoreAvatar name={req.nickname} className="size-8 text-xs" />
                  <div>
                    <p className="text-sm font-bold text-foreground">{req.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.menuMemo || '메모 없음'} · {formatDateTime(req.requestedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleReject(req.userId)}
                    className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                  >
                    거절
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isProcessing || isFull}
                    onClick={() => handleApprove(req.userId)}
                    className="h-8 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    수락
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
