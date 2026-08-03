import Link from 'next/link'
import { Flame, MapPin, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PotStatusBadge } from '@/components/status-badge'
import { StoreAvatar } from '@/components/store-avatar'
import { getFoodEmoji } from '@/lib/food-emoji'
import { formatDeadline, formatDistance, formatWon } from '@/lib/format'
import type { Pot, PotStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const ACCENT_BORDER: Record<PotStatus, string> = {
  OPEN: 'border-l-primary',
  CLOSED: 'border-l-status-closed',
  ORDERED: 'border-l-status-ordered',
  CANCELED: 'border-l-status-canceled',
}

export function PotCard({ pot, index }: { pot: Pot; index?: number }) {
  const deadline = formatDeadline(pot.deadlineAt)
  const isAmount = pot.targetType === 'AMOUNT'
  const amount = pot.currentAmount ?? 0
  const progress = isAmount ? (amount / pot.targetValue) * 100 : 0
  const showUrgentRibbon = pot.status === 'OPEN' && deadline.urgent
  const foodEmoji = getFoodEmoji(pot.orderSummary, pot.storeName)

  return (
    <Link href={`/pots/${pot.id}`} className="block transition active:scale-[0.99]">
      <Card className={cn('relative border-l-4 p-4', ACCENT_BORDER[pot.status])}>
        {/* 위치확인 / 마감임박 배지 (우측 상단, 세로로 쌓임) */}
        {(pot.isLocationVerified || showUrgentRibbon) && (
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
            {showUrgentRibbon && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-destructive px-2 text-xs font-bold text-destructive-foreground shadow-sm">
                <Flame className="size-3.5" />
                마감임박
              </span>
            )}
            {pot.isLocationVerified && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-status-ordered/12 px-2 text-xs font-semibold text-status-ordered">
                <ShieldCheck className="size-3.5" />
                위치확인
              </span>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <div className="relative shrink-0">
            <StoreAvatar name={pot.storeName} emoji={foodEmoji} className="size-16 text-2xl" />
            {index !== undefined && (
              <span className="absolute -bottom-1.5 -left-1.5 flex size-6 items-center justify-center rounded-lg bg-foreground text-[11px] font-extrabold tabular-nums text-background shadow-sm">
                {String(index).padStart(2, '0')}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <PotStatusBadge status={pot.status} />
            <h3 className="mt-1 pr-16 text-base font-extrabold text-foreground">{pot.storeName}</h3>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{pot.orderSummary}</p>

            <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              <span className="line-clamp-1">{pot.pickupName}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="shrink-0">{formatDistance(pot.distanceMeters)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <span
            className={cn(
              'text-sm font-semibold',
              deadline.urgent ? 'text-destructive' : 'text-foreground',
            )}
          >
            {deadline.text}
          </span>

          <div className="min-w-28 text-right">
            {isAmount ? (
              <>
                <p className="text-xs font-semibold tabular-nums text-foreground">
                  {formatWon(amount)} / {formatWon(pot.targetValue)}
                </p>
                <Progress value={progress} className="mt-1" />
              </>
            ) : (
              <p className="text-sm font-bold tabular-nums text-primary">
                {pot.currentCount}
                <span className="text-muted-foreground">/{pot.targetValue}명</span>
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
