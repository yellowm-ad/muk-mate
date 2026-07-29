import Link from 'next/link'
import { MapPin, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PotStatusBadge } from '@/components/status-badge'
import { formatDeadline, formatDistance, formatWon } from '@/lib/format'
import type { Pot } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PotCard({ pot }: { pot: Pot }) {
  const deadline = formatDeadline(pot.deadlineAt)
  const isAmount = pot.targetType === 'AMOUNT'
  const amount = pot.currentAmount ?? 0
  const progress = isAmount ? (amount / pot.targetValue) * 100 : 0

  return (
    <Link href={`/pots/${pot.id}`} className="block transition active:scale-[0.99]">
      <Card className="relative p-4">
        {/* 위치확인 배지 (우측 상단) */}
        {pot.isLocationVerified && (
          <span className="absolute right-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-status-ordered/12 px-2 text-xs font-semibold text-status-ordered">
            <ShieldCheck className="size-3.5" />
            위치확인
          </span>
        )}

        <div className="flex items-start gap-2">
          <PotStatusBadge status={pot.status} />
        </div>

        <h3 className="mt-2 pr-16 text-base font-bold text-foreground">{pot.storeName}</h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{pot.orderSummary}</p>

        <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" />
          <span className="line-clamp-1">{pot.pickupName}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="shrink-0">{formatDistance(pot.distanceMeters)}</span>
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
