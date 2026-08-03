'use client'

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ShoppingBag,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { markAllNotificationsAsRead, markNotificationAsRead } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import type { AppNotification, NotificationType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NotificationsViewProps {
  initialNotifications: AppNotification[]
}

function getRelativeTimeText(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay === 1) return '어제'
  if (diffDay < 7) return `${diffDay}일 전`
  return formatDateTime(isoString)
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'APPLICATION_SUBMITTED':
      return <CheckCircle2 className="size-5 text-primary" />
    case 'APPLICATION_RECEIVED':
      return <UserPlus className="size-5 text-primary" />
    case 'APPLICATION_APPROVED':
      return <CheckCircle2 className="size-5 text-[#10B981]" />
    case 'APPLICATION_REJECTED':
      return <XCircle className="size-5 text-destructive" />
    case 'POT_COMPLETED':
      return <ShoppingBag className="size-5 text-[#10B981]" />
    case 'POT_CANCELED':
      return <AlertCircle className="size-5 text-destructive" />
    default:
      return <CheckCircle2 className="size-5 text-primary" />
  }
}

export function NotificationsView({ initialNotifications }: NotificationsViewProps) {
  const router = useRouter()
  const [notificationsList, setNotificationsList] = useState<AppNotification[]>(initialNotifications)
  const [showReadAllConfirm, setShowReadAllConfirm] = useState(false)
  const [processing, setProcessing] = useState(false)

  const unreadCount = useMemo(
    () => notificationsList.filter((n) => !n.isRead).length,
    [notificationsList],
  )

  const groups = useMemo(() => {
    const today: AppNotification[] = []
    const last7Days: AppNotification[] = []
    const earlier: AppNotification[] = []

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000

    for (const item of notificationsList) {
      const itemTime = new Date(item.createdAt).getTime()
      if (itemTime >= todayStart) {
        today.push(item)
      } else if (itemTime >= sevenDaysAgo) {
        last7Days.push(item)
      } else {
        earlier.push(item)
      }
    }

    return { today, last7Days, earlier }
  }, [notificationsList])

  async function handleNotificationClick(notification: AppNotification) {
    if (!notification.isRead) {
      // Optimistically update local read state
      setNotificationsList((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      )
      markNotificationAsRead(notification.id).catch(() => {})
    }

    const targetPath = notification.actionPath || (notification.potId ? `/pots/${notification.potId}` : '/pots')
    router.push(targetPath)
  }

  async function handleReadAll() {
    setProcessing(true)
    try {
      await markAllNotificationsAsRead()
      setNotificationsList((prev) => prev.map((item) => ({ ...item, isRead: true })))
      setShowReadAllConfirm(false)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-1 backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로"
            className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
          >
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-base font-bold text-foreground">알림</span>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => setShowReadAllConfirm(true)}
            className="px-3 text-xs font-semibold text-primary transition active:scale-[0.97] hover:underline"
          >
            모두 읽음
          </button>
        )}
      </header>

      {notificationsList.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="mt-4 text-base font-bold text-foreground">아직 받은 알림이 없어요</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            공동주문에 참여하거나 직접 모집해보세요.
          </p>
          <button
            type="button"
            onClick={() => router.push('/pots')}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-xs transition active:scale-[0.97]"
          >
            공동주문 둘러보기
          </button>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* 오늘 */}
          {groups.today.length > 0 && (
            <section className="border-b border-border/60">
              <div className="bg-muted/40 px-4 py-2 text-xs font-bold text-muted-foreground">
                오늘
              </div>
              <ul className="divide-y divide-border/60">
                {groups.today.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    onClick={() => handleNotificationClick(item)}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* 최근 7일 */}
          {groups.last7Days.length > 0 && (
            <section className="border-b border-border/60">
              <div className="bg-muted/40 px-4 py-2 text-xs font-bold text-muted-foreground">
                최근 7일
              </div>
              <ul className="divide-y divide-border/60">
                {groups.last7Days.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    onClick={() => handleNotificationClick(item)}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* 이전 */}
          {groups.earlier.length > 0 && (
            <section>
              <div className="bg-muted/40 px-4 py-2 text-xs font-bold text-muted-foreground">
                이전
              </div>
              <ul className="divide-y divide-border/60">
                {groups.earlier.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    onClick={() => handleNotificationClick(item)}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* 모두 읽음 확인 모달 */}
      {showReadAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-[320px] rounded-2xl bg-background p-5 shadow-xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-foreground">모든 알림을 읽음 처리할까요?</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              읽지 않은 모든 알림의 배지와 읽지 않음 표시가 사라집니다.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowReadAllConfirm(false)}
                disabled={processing}
                className="h-10 flex-1 rounded-xl border border-border text-xs font-bold text-foreground transition active:scale-[0.97]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReadAll}
                disabled={processing}
                className="h-10 flex-1 rounded-xl bg-primary text-xs font-bold text-primary-foreground transition active:scale-[0.97] hover:bg-primary/90"
              >
                {processing ? '처리 중...' : '모두 읽음'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationItem({
  item,
  onClick,
}: {
  item: AppNotification
  onClick: () => void
}) {
  return (
    <li
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-start gap-3 px-4 py-3.5 transition active:bg-muted/70 hover:bg-muted/40',
        !item.isRead ? 'bg-primary/5' : 'bg-background',
      )}
    >
      <div className="relative mt-0.5 shrink-0">
        <div className="flex size-9 items-center justify-center rounded-full bg-muted/80">
          {getNotificationIcon(item.type)}
        </div>
        {!item.isRead && (
          <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4
            className={cn(
              'truncate text-sm text-foreground',
              !item.isRead ? 'font-bold' : 'font-semibold',
            )}
          >
            {item.title}
          </h4>
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            {getRelativeTimeText(item.createdAt)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {item.body}
        </p>
      </div>

      <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground/50" />
    </li>
  )
}
