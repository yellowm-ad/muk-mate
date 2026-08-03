import { cn } from '@/lib/utils'
import { POT_STATUS_META, APPROVAL_META } from '@/lib/constants'
import type { Approval, PotStatus } from '@/lib/types'

const STATUS_CLASS: Record<PotStatus, string> = {
  OPEN: 'bg-status-open text-primary-foreground',
  CLOSED: 'bg-status-closed/15 text-status-closed',
  ORDERED: 'border border-status-ordered text-status-ordered bg-transparent',
  CANCELED: 'bg-status-canceled/20 text-status-canceled',
}

export function PotStatusBadge({
  status,
  className,
}: {
  status: PotStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
        STATUS_CLASS[status],
        className,
      )}
    >
      {POT_STATUS_META[status].label}
    </span>
  )
}

const APPROVAL_CLASS: Record<Approval, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
}

export function ApprovalBadge({
  status,
  className,
}: {
  status: Approval
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
        APPROVAL_CLASS[status],
        className,
      )}
    >
      {APPROVAL_META[status].label}
    </span>
  )
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full bg-status-ordered/12 px-2 text-xs font-semibold text-status-ordered',
        className,
      )}
    >
      위치확인
    </span>
  )
}
