import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-8" />
      </div>
      <p className="text-base font-bold text-foreground text-balance">{title}</p>
      {description && (
        <p className="max-w-64 text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
