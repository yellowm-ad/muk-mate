'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { AppHeader } from '@/components/app-header'
import { StoreAvatar } from '@/components/store-avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { submitMannerReview } from '@/lib/api'
import { MANNER_TAGS_BY_RATING } from '@/lib/manner-constants'
import type { MannerRating, MannerReviewTarget } from '@/lib/types'
import { cn } from '@/lib/utils'

const RATING_OPTIONS: { rating: MannerRating; label: string }[] = [
  { rating: 'GOOD', label: '좋았어요' },
  { rating: 'NEUTRAL', label: '보통이에요' },
  { rating: 'BAD', label: '아쉬웠어요' },
]

function ReviewCard({ target, potId, onSubmitted }: { target: MannerReviewTarget; potId: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState<MannerRating | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (target.alreadyReviewed) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <StoreAvatar name={target.nickname} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{target.nickname}</p>
          <p className="text-xs text-muted-foreground">{target.role === 'HOST' ? '모집자' : '참여자'}</p>
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
          <CheckCircle2 className="size-4" />
          평가 완료
        </span>
      </Card>
    )
  }

  function selectRating(next: MannerRating) {
    setRating(next)
    setTags([])
    setError(null)
  }

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  async function handleSubmit() {
    if (!rating) {
      setError('평가를 선택해 주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitMannerReview(potId, { revieweeId: target.userId, rating, tags })
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : '평가 제출에 실패했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <StoreAvatar name={target.nickname} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{target.nickname}</p>
          <p className="text-xs text-muted-foreground">{target.role === 'HOST' ? '모집자' : '참여자'}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {RATING_OPTIONS.map((opt) => (
          <button
            key={opt.rating}
            type="button"
            onClick={() => selectRating(opt.rating)}
            className={cn(
              'h-10 rounded-xl border text-xs font-bold transition',
              rating === opt.rating
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:bg-muted/50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {rating && (
        <div className="flex flex-wrap gap-1.5">
          {MANNER_TAGS_BY_RATING[rating].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                tags.includes(tag)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">한 번 제출하면 수정할 수 없어요.</p>

      <Button
        onClick={handleSubmit}
        disabled={!rating || submitting}
        className="h-11 rounded-xl font-bold"
      >
        {submitting ? '제출하는 중...' : '제출'}
      </Button>
    </Card>
  )
}

export function PotMannerReviewView({
  potId,
  storeName,
  initialTargets,
}: {
  potId: string
  storeName: string
  initialTargets: MannerReviewTarget[]
}) {
  const [targets, setTargets] = useState(initialTargets)

  return (
    <>
      <AppHeader title="매너 평가" showBack />

      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{storeName}</span> 공동주문에서 함께한 메이트를 평가해 주세요.
        </p>

        {targets.length === 0 ? (
          <div className="my-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm font-bold text-foreground">평가할 수 있는 대상이 없어요.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              이미 모든 평가를 마쳤거나, 이 공동주문의 호스트/승인된 참여자가 아닐 수 있어요.
            </p>
          </div>
        ) : (
          targets.map((target) => (
            <ReviewCard
              key={target.userId}
              target={target}
              potId={potId}
              onSubmitted={() =>
                setTargets((prev) =>
                  prev.map((t) => (t.userId === target.userId ? { ...t, alreadyReviewed: true } : t)),
                )
              }
            />
          ))
        )}
      </div>
    </>
  )
}
