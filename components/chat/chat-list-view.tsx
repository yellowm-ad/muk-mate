'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Clock, MapPin, MessageCircle, Search, Users, Utensils } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { PotStatusBadge } from '@/components/status-badge'
import { StoreAvatar } from '@/components/store-avatar'
import { getFoodEmoji } from '@/lib/food-emoji'
import { buttonVariants } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChatRoom } from '@/lib/types'

function RoomRow({ room }: { room: ChatRoom }) {
  return (
    <Link
      href={`/chat/${room.id}`}
      className="flex items-center gap-3 px-4 py-3.5 transition active:scale-[0.99] hover:bg-muted/60 bg-card"
    >
      <StoreAvatar
        name={room.title}
        emoji={getFoodEmoji(room.title)}
        className="size-12 text-xl shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-bold text-foreground">{room.title}</p>
          {room.potStatus && <PotStatusBadge status={room.potStatus} className="shrink-0 text-[11px]" />}
        </div>
        {room.subtitle && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{room.subtitle}</span>
          </div>
        )}
        <p className="mt-1 truncate text-xs text-muted-foreground/90">
          {room.lastMessage || '아직 메시지가 없어요. 첫 대화를 시작해 보세요.'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {room.lastMessageAt && (
          <span className="text-[11px] font-medium text-muted-foreground">
            {formatRelativeTime(room.lastMessageAt)}
          </span>
        )}
        {room.unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
            {room.unreadCount}
          </span>
        )}
      </div>
    </Link>
  )
}

export function ChatListView({
  myRooms,
  communityRooms,
}: {
  myRooms: ChatRoom[]
  communityRooms: ChatRoom[]
}) {
  const [tab, setTab] = useState<'MINE' | 'COMMUNITY'>('MINE')

  // 읽지 않은 메시지 우선 정렬 (§4-1)
  const sortedMyRooms = [...myRooms].sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
    return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
  })

  return (
    <>
      <AppHeader title="채팅" />

      {/* 1. 상단 탭 (내 채팅 / 음식 커뮤니티) */}
      <div className="flex border-b border-border bg-card px-4">
        {(
          [
            { key: 'MINE', label: `내 채팅 (${myRooms.length})` },
            { key: 'COMMUNITY', label: '음식 커뮤니티' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'relative flex h-11 flex-1 items-center justify-center text-sm font-semibold transition',
              tab === t.key ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {t.label}
            {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {/* 2. 목록 영역 */}
      {tab === 'MINE' ? (
        sortedMyRooms.length > 0 ? (
          <div className="flex flex-1 flex-col divide-y divide-border">
            {sortedMyRooms.map((room) => (
              <RoomRow key={room.id} room={room} />
            ))}
          </div>
        ) : (
          /* 내 채팅이 없는 경우 (§14) */
          <div className="my-8 flex flex-1 flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="size-6" />
            </div>
            <p className="text-base font-bold text-foreground">아직 참여 중인 주문 채팅이 없어요.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              공동주문에 참여하거나 모집글을 올리면 채팅방이 여기에 표시됩니다.
            </p>
            <Link
              href="/pots"
              className={cn(
                buttonVariants({ variant: 'default' }),
                'mt-5 h-11 rounded-xl px-5 font-bold',
              )}
            >
              <Search className="mr-1.5 size-4" />
              공동주문 둘러보기
            </Link>
          </div>
        )
      ) : communityRooms.length > 0 ? (
        <div className="flex flex-1 flex-col divide-y divide-border">
          {communityRooms.map((room) => (
            <RoomRow key={room.id} room={room} />
          ))}
        </div>
      ) : (
        /* 커뮤니티 고정방 기본목록 (§4-2) */
        <div className="flex flex-1 flex-col divide-y divide-border">
          <Link
            href="/chat"
            className="flex items-center gap-3 px-4 py-3.5 transition active:scale-[0.99] hover:bg-muted/60 bg-card"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
              🍜
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">오늘 뭐 먹지 · 맛집 추천</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                전북대 맛집 공유와 메뉴 추천 이야기를 나눠보세요.
              </p>
            </div>
          </Link>
          <Link
            href="/chat"
            className="flex items-center gap-3 px-4 py-3.5 transition active:scale-[0.99] hover:bg-muted/60 bg-card"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
              🍱
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">같이 먹어요 · 음식 여행</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                혼밥이 싫을 때 같이 먹을 친구를 커뮤니티에서 찾아보세요.
              </p>
            </div>
          </Link>
        </div>
      )}
    </>
  )
}
