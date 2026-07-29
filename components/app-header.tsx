'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  title?: ReactNode
  /** 뒤로가기 버튼 표시 여부 */
  showBack?: boolean
  /** 우측 액션 슬롯 */
  action?: ReactNode
  /** 커스텀 뒤로가기 핸들러 (없으면 router.back) */
  onBack?: () => void
  className?: string
  /** 좌측 커스텀 슬롯 (뒤로가기 대신 사용) */
  leftSlot?: ReactNode
}

export function AppHeader({
  title,
  showBack = false,
  action,
  onBack,
  className,
  leftSlot,
}: AppHeaderProps) {
  const router = useRouter()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-border bg-background/90 px-2 backdrop-blur',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {leftSlot
          ? leftSlot
          : showBack && (
              <button
                type="button"
                aria-label="뒤로가기"
                onClick={() => (onBack ? onBack() : router.back())}
                className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}
        {title && (
          <h1 className="truncate px-1 text-lg font-bold text-foreground">{title}</h1>
        )}
      </div>
      {action && <div className="flex items-center gap-1 pr-1">{action}</div>}
    </header>
  )
}
