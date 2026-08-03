'use client'

import { Bell } from 'lucide-react'
import useRouter from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { getUnreadNotificationCount } from '@/lib/api'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  initialCount?: number
  className?: string
}

export function NotificationBell({ initialCount = 0, className }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState<number>(initialCount)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount()
      setUnreadCount(count)
    } catch {
      // silent catch for background polling
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()

    let intervalId: NodeJS.Timeout | null = null

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (document.visibilityState === 'visible') {
            fetchUnreadCount()
          }
        }, 30000)
      }
    }

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount()
        startPolling()
      } else {
        stopPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchUnreadCount])

  const ariaLabel =
    unreadCount === 0
      ? '알림'
      : unreadCount >= 100
      ? '읽지 않은 알림 100개 이상'
      : `읽지 않은 알림 ${unreadCount}개`

  const badgeText = unreadCount >= 100 ? '99+' : String(unreadCount)

  return (
    <a
      href="/notifications"
      aria-label={ariaLabel}
      className={cn(
        'relative flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted',
        className,
      )}
    >
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F04438] px-1 text-[10px] font-extrabold text-white shadow-xs">
          {badgeText}
        </span>
      )}
    </a>
  )
}
