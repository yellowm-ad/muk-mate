'use client'

import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ViewerState } from '@/types/pot-member'

interface JoinButtonProps {
  potId: string
  viewerState: ViewerState
  loading?: boolean
  onOpenConfirmSheet?: () => void
  onCancelRequest?: () => Promise<void>
  onHostAction?: () => void
}

export function JoinButton({
  potId,
  viewerState,
  loading = false,
  onOpenConfirmSheet,
  onCancelRequest,
  onHostAction,
}: JoinButtonProps) {
  const router = useRouter()
  const [internalLoading, setInternalLoading] = useState(false)

  const isBusy = loading || internalLoading

  async function handleClick() {
    if (isBusy) return

    switch (viewerState) {
      case 'GUEST':
        router.push(`/login?next=/pots/${potId}`)
        break
      case 'JOINABLE':
        onOpenConfirmSheet?.()
        break
      case 'PENDING':
      case 'MEMBER':
        if (confirm(viewerState === 'PENDING' ? '신청을 취소하시겠습니까?' : '공동주문 참여를 취소하시겠습니까?')) {
          setInternalLoading(true)
          try {
            await onCancelRequest?.()
          } finally {
            setInternalLoading(false)
          }
        }
        break
      case 'HOST':
        onHostAction?.()
        break
      default:
        break
    }
  }

  const getConfig = () => {
    switch (viewerState) {
      case 'GUEST':
        return {
          label: '로그인하고 참여하기',
          disabled: false,
          variant: 'default' as const,
          className: 'bg-primary text-primary-foreground hover:bg-primary/90',
        }
      case 'JOINABLE':
        return {
          label: '참여하기',
          disabled: false,
          variant: 'default' as const,
          className: 'bg-primary text-primary-foreground hover:bg-primary/90',
        }
      case 'PENDING':
        return {
          label: '승인 대기 중 · 신청 취소',
          disabled: false,
          variant: 'outline' as const,
          className: 'border-muted-foreground/30 text-foreground hover:bg-muted',
        }
      case 'MEMBER':
        return {
          label: '참여 취소',
          disabled: false,
          variant: 'outline' as const,
          className: 'border-muted-foreground/30 text-foreground hover:bg-muted',
        }
      case 'HOST':
        return {
          label: '모집 마감하기',
          disabled: false,
          variant: 'default' as const,
          className: 'bg-primary text-primary-foreground hover:bg-primary/90',
        }
      case 'FULL':
        return {
          label: '인원이 다 찼어요',
          disabled: true,
          variant: 'secondary' as const,
          className: 'bg-muted text-muted-foreground opacity-100',
        }
      case 'CLOSED':
        return {
          label: '모집이 끝났어요',
          disabled: true,
          variant: 'secondary' as const,
          className: 'bg-muted text-muted-foreground opacity-100',
        }
      case 'REJECTED':
        return {
          label: '참여할 수 없어요',
          disabled: true,
          variant: 'secondary' as const,
          className: 'bg-muted text-muted-foreground opacity-100',
        }
    }
  }

  const config = getConfig()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="pointer-events-auto mx-auto max-w-[430px] border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Button
          type="button"
          variant={config.variant}
          disabled={config.disabled || isBusy}
          onClick={handleClick}
          className={`h-[52px] w-full rounded-xl text-base font-bold transition-all active:scale-[0.99] ${config.className}`}
        >
          {isBusy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-5 animate-spin" />
              처리 중...
            </span>
          ) : (
            config.label
          )}
        </Button>
      </div>
    </div>
  )
}
