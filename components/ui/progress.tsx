import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number // 0 - 100
  className?: string
  barClassName?: string
}

function Progress({ value, className, barClassName }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted-foreground/15', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full bg-primary transition-all', barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { Progress }
