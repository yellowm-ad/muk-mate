import type { LucideIcon } from 'lucide-react'

export function TabPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-8" />
      </div>
      <p className="text-lg font-bold text-foreground text-balance">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
    </div>
  )
}
