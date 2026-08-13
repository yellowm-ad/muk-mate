'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Clock,
  ExternalLink,
  Flag,
  Info,
  MapPin,
  MoreVertical,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserX,
} from 'lucide-react'

import { ReportModal } from '@/components/chat/report-modal'
import { MannerAvatar } from '@/components/manner-avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { blockUser, deleteMessages, getMessages, removeFriend, sendMessage, unblockUser } from '@/lib/api'
import { formatClock, formatDateDivider, formatDateTime, isSameDay } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Message, RoomAccess, RoomReadEntry } from '@/lib/types'

const POLL_INTERVAL_MS = 2500
// 채팅 삭제(카카오톡 스타일) — 내가 보낸 지 이 시간 안이면 전체 삭제, 지나면 나만 안 보이게 삭제.
const MESSAGE_DELETE_WINDOW_MS = 5 * 60 * 1000

/** 읽음 표시(v2.5) — 이 메시지를 보낸 사람을 제외한 참여자 중 아직 안 읽은 인원수 (카카오톡 그룹채팅 방식) */
function unreadCountFor(message: Message, reads: RoomReadEntry[]): number {
  const msgId = Number(message.id)
  return reads.filter((r) => r.userId !== message.senderId && r.lastReadMessageId < msgId).length
}

/** 전체 삭제(모두에게 "메시지가 삭제되었습니다") 가능 여부 — 서버가 최종 판정하지만 확인창 문구 선택엔 이걸로 미리 판단한다 */
function isRealDeleteEligible(m: Message): boolean {
  if (!m.isMine || m.deletedAt) return false
  return Date.now() - new Date(m.createdAt).getTime() < MESSAGE_DELETE_WINDOW_MS
}

export function ChatRoomView({
  room,
  initialMessages,
  initialReads = [],
  initialReadCursor = null,
}: {
  room: RoomAccess
  initialMessages: Message[]
  initialReads?: RoomReadEntry[]
  /** 이번 방문 이전까지 읽은 마지막 메시지 id. null이면 첫 방문(복원할 지점 없음). */
  initialReadCursor?: number | null
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [reads, setReads] = useState<RoomReadEntry[]>(initialReads)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 더보기 메뉴 및 모달 상태
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [safetyGuideOpen, setSafetyGuideOpen] = useState(false)

  // 채팅 삭제(선택 모드) 상태
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 신고 모달 상태
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<{
    nickname: string
    userId: string
    messageId?: number
  } | null>(null)

  // 스크롤 및 새 메시지 알림 상태
  const [unreadNewCount, setUnreadNewCount] = useState(0)
  const [isScrolledUp, setIsScrolledUp] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const didInitialScrollRef = useRef(false)
  const lastIdRef = useRef<number>(
    initialMessages.length > 0 ? Number(initialMessages[initialMessages.length - 1].id) : 0,
  )

  // 스크롤 위치 감지
  function handleScroll() {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsScrolledUp(!isAtBottom)
    if (isAtBottom) {
      setUnreadNewCount(0)
    }
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    setUnreadNewCount(0)
  }

  // 폴링: 2.5초 간격 증분 조회. 새 메시지가 없어도 읽음 커서(reads)는 매번 갱신한다 —
  // 상대방이 읽기만 하고 새 메시지를 안 보냈어도 내 화면의 안읽음 숫자가 줄어야 하기 때문.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return
      try {
        const { messages: fresh, reads: freshReads, deletedMessageIds } = await getMessages(room.id, lastIdRef.current)
        setReads(freshReads)

        // 이미 화면에 있던 메시지가 그 사이 전체 삭제됐을 수도 있으니 매번 반영한다(§채팅 삭제).
        if (deletedMessageIds.length > 0) {
          const delSet = new Set(deletedMessageIds)
          setMessages((prev) =>
            prev.map((m) => (delSet.has(Number(m.id)) && !m.deletedAt ? { ...m, deletedAt: new Date().toISOString() } : m)),
          )
        }

        if (fresh.length === 0) return

        lastIdRef.current = Number(fresh[fresh.length - 1].id)
        setMessages((prev) => [...prev, ...fresh])

        if (isScrolledUp) {
          setUnreadNewCount((cnt) => cnt + fresh.length)
        }
      } catch {
        // 폴링 중 오류는 조용히 무시
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [room.id, isScrolledUp])

  // 최초 진입 시 1회: 마지막으로 읽은 지점으로 스크롤 복원 (없으면 맨 아래).
  // useLayoutEffect로 페인트 전에 위치를 잡아야 "맨 위가 잠깐 보였다가 아래로 튀는" 깜빡임이 없다.
  useLayoutEffect(() => {
    if (initialReadCursor !== null) {
      const firstUnread = initialMessages.find((m) => Number(m.id) > initialReadCursor)
      const el = firstUnread ? messageRefs.current.get(firstUnread.id) : null
      if (el) {
        el.scrollIntoView({ block: 'start' })
        didInitialScrollRef.current = true
        return
      }
    }
    bottomRef.current?.scrollIntoView({ block: 'end' })
    didInitialScrollRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 새 메시지 수신 시 스크롤 제어 (최초 진입 스크롤 복원과 겹치지 않도록 그 이후에만 동작)
  useEffect(() => {
    if (!didInitialScrollRef.current) return
    if (!isScrolledUp) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages.length, isScrolledUp])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return

    setSending(true)
    setError(null)
    try {
      const message = await sendMessage(room.id, content)
      lastIdRef.current = Number(message.id)
      setMessages((prev) => [...prev, message])
      setInput('')
      scrollToBottom()
    } catch (err) {
      setError(err instanceof Error ? err.message : '메시지 전송에 실패했어요.')
    } finally {
      setSending(false)
    }
  }

  // 메시지 신고 열기
  function openReportMessage(msg: Message) {
    if (msg.isMine || !msg.senderId) return
    setReportTarget({
      nickname: msg.senderNickname,
      userId: msg.senderId,
      messageId: Number(msg.id),
    })
    setReportModalOpen(true)
  }

  // 사용자 신고 열기 (더보기 메뉴에서) — DM방은 상대가 항상 정해져 있으니 메시지가 하나도 없어도 정확히 잡힌다.
  function openReportUser() {
    setMoreMenuOpen(false)
    if (room.dm) {
      setReportTarget({ nickname: room.dm.otherNickname, userId: room.dm.otherUserId })
      setReportModalOpen(true)
      return
    }
    const otherMsg = messages.find((m) => !m.isMine && m.senderId)
    setReportTarget({
      nickname: otherMsg?.senderNickname || '참여자',
      userId: otherMsg?.senderId || '',
    })
    setReportModalOpen(true)
  }

  // 친구 삭제 — 메신저 제한은 없고, 삭제 후 이 방을 다시 열면 "친구로 등록되지 않은" 배너만 뜬다.
  async function handleUnfriend() {
    if (!room.dm) return
    if (!confirm(`${room.dm.otherNickname}님을 친구에서 삭제할까요?`)) return
    setMoreMenuOpen(false)
    await removeFriend(room.dm.otherUserId)
    router.refresh()
  }

  // 차단/차단 해제 — 차단하면 상대가 나에게 더 이상 메시지를 보낼 수 없다.
  async function handleToggleBlock() {
    if (!room.dm) return
    setMoreMenuOpen(false)
    if (room.dm.isBlockedByMe) {
      await unblockUser(room.dm.otherUserId)
    } else {
      if (!confirm(`${room.dm.otherNickname}님을 차단할까요? 친구 관계도 함께 해제돼요.`)) return
      await blockUser(room.dm.otherUserId)
    }
    router.refresh()
  }

  // 채팅 삭제(선택 모드) — 더보기 메뉴에서 진입
  function startSelectMode() {
    setMoreMenuOpen(false)
    setSelectedIds(new Set())
    setSelectMode(true)
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function toggleSelectMessage(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedMessages = messages.filter((m) => selectedIds.has(Number(m.id)))
  const allSelectedRealDelete = selectedMessages.length > 0 && selectedMessages.every(isRealDeleteEligible)

  async function handleConfirmDelete() {
    setDeleting(true)
    try {
      const ids = [...selectedIds]
      await deleteMessages(room.id, ids)
      const idSet = new Set(ids)
      setMessages((prev) => {
        const next: Message[] = []
        for (const m of prev) {
          if (!idSet.has(Number(m.id))) {
            next.push(m)
            continue
          }
          if (isRealDeleteEligible(m)) {
            next.push({ ...m, deletedAt: new Date().toISOString() })
          }
          // 그 외(남의 메시지 · 5분 지난 내 메시지)는 나만 안 보이게 삭제 — 내 화면에서 바로 제거
        }
        return next
      })
      setDeleteConfirmOpen(false)
      exitSelectMode()
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했어요.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col">
      {/* 1. 상단 헤더 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-2 backdrop-blur">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <button
            type="button"
            onClick={selectMode ? exitSelectMode : () => router.back()}
            aria-label={selectMode ? '선택 취소' : '뒤로'}
            className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="truncate text-base font-bold text-foreground">
            {selectMode ? `${selectedIds.size}개 선택` : room.title}
          </h1>
        </div>

        {selectMode ? (
          <button
            type="button"
            onClick={() => selectedIds.size > 0 && setDeleteConfirmOpen(true)}
            disabled={selectedIds.size === 0}
            className="px-3 text-sm font-bold text-destructive transition disabled:opacity-40"
          >
            삭제
          </button>
        ) : (
          /* 더보기 버튼 (⋮) */
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              aria-label="더보기 메뉴"
              className="flex size-11 items-center justify-center rounded-full text-foreground transition active:scale-[0.95] hover:bg-muted"
            >
              <MoreVertical className="size-5" />
            </button>

            {/* 더보기 팝오버 메뉴 (§5-1) */}
            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                <div className="absolute right-2 top-12 z-50 flex w-44 flex-col rounded-xl border border-border bg-popover p-1 shadow-lg divide-y divide-border/50 text-xs font-semibold text-popover-foreground">
                  {room.pot && (
                    <Link
                      href={`/pots/${room.pot.id}`}
                      onClick={() => setMoreMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted rounded-lg"
                    >
                      <ExternalLink className="size-3.5 text-primary" />
                      공동주문 상세보기
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false)
                      setSafetyGuideOpen(true)
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted rounded-lg"
                  >
                    <ShieldCheck className="size-3.5 text-emerald-600" />
                    안전 이용 안내
                  </button>
                  <button
                    type="button"
                    onClick={startSelectMode}
                    className="flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted rounded-lg"
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                    채팅 삭제
                  </button>
                  {room.dm?.isFriend && (
                    <button
                      type="button"
                      onClick={handleUnfriend}
                      className="flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted rounded-lg"
                    >
                      <UserMinus className="size-3.5 text-muted-foreground" />
                      친구 삭제
                    </button>
                  )}
                  {room.dm && (
                    <button
                      type="button"
                      onClick={handleToggleBlock}
                      className="flex items-center gap-2 px-3 py-2.5 text-left text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <UserX className="size-3.5" />
                      {room.dm.isBlockedByMe ? '차단 해제' : '차단하기'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openReportUser}
                    className="flex items-center gap-2 px-3 py-2.5 text-left text-destructive hover:bg-destructive/10 rounded-lg"
                  >
                    <ShieldAlert className="size-3.5" />
                    사용자 신고
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* 2. 주문 채팅방 상단 고정 정보 (§5-1) */}
      {room.pot && (
        <div className="flex flex-col gap-1 border-b border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">{room.pot.storeName}</span>
            <Link
              href={`/pots/${room.pot.id}`}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              상세보기 &gt;
            </Link>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-primary" />
              {room.pot.pickupName}
            </span>
            {room.pot.pickupAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 text-primary" />
                {formatDateTime(room.pot.pickupAt)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. 안내 배너 (§9-1, §6, §친구 기능) */}
      {room.type === 'ORDER' ? (
        <div className="flex items-start gap-2 bg-primary/5 px-4 py-2 text-xs text-primary border-b border-primary/10">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
          <p className="leading-snug">
            안전한 조율을 위해 수령 장소와 시각을 확인하세요. 불쾌한 대화나 문제 발생 시 상대방 메시지를 신고할 수 있습니다.
          </p>
        </div>
      ) : room.type === 'DM' ? (
        !room.dm?.isFriend && (
          <div className="flex items-start gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-700 border-b border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <p className="leading-snug">친구로 등록되지 않은 사용자입니다.</p>
          </div>
        )
      ) : (
        <div className="flex items-start gap-2 bg-muted/60 px-4 py-2 text-xs text-muted-foreground border-b border-border">
          <Info className="size-4 shrink-0 mt-0.5" />
          <p className="leading-snug">
            서로 존중하며 대화해 주세요. 욕설·도배·광고·사기성 링크·개인정보 요구는 신고 대상입니다.
          </p>
        </div>
      )}

      {/* 4. 메시지 목록 영역 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4"
      >
        {messages.map((m, idx) => {
          const prev = messages[idx - 1]
          const showDivider = !prev || !isSameDay(prev.createdAt, m.createdAt)

          if (m.type === 'SYSTEM') {
            return (
              <div key={m.id} ref={(el) => { if (el) messageRefs.current.set(m.id, el) }}>
                {showDivider && <DateDivider iso={m.createdAt} />}
                <p className="my-2.5 text-center text-xs font-semibold text-muted-foreground/80 bg-muted/30 py-1 px-3 rounded-full mx-auto w-fit">
                  {m.content}
                </p>
              </div>
            )
          }

          const showNickname = !m.isMine && (!prev || prev.senderId !== m.senderId || showDivider)
          const unreadCount = room.type === 'ORDER' ? unreadCountFor(m, reads) : 0
          const isDeleted = Boolean(m.deletedAt)
          const isSelected = selectedIds.has(Number(m.id))

          return (
            <div key={m.id} ref={(el) => { if (el) messageRefs.current.set(m.id, el) }}>
              {showDivider && <DateDivider iso={m.createdAt} />}
              <div className="flex items-end gap-1.5">
                {/* 채팅 삭제 선택 모드 체크박스 — 이미 전체 삭제된 메시지는 더 지울 게 없어 제외 */}
                {selectMode && !isDeleted && (
                  <label className="flex size-6 shrink-0 items-center justify-center self-end pb-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectMessage(Number(m.id))}
                      className="size-4 accent-primary"
                      aria-label="메시지 선택"
                    />
                  </label>
                )}
                <div className={cn('flex flex-1 gap-2', m.isMine ? 'flex-row-reverse' : 'flex-row')}>
                  {/* 발신자 아바타(v2.14) — 같은 사람이 연달아 보낸 메시지는 첫 줄에만 표시, 나머지는 자리만 비운다 */}
                  {!m.isMine && (
                    <div className="w-7 shrink-0 self-end">
                      {showNickname && m.manner && (
                        <MannerAvatar
                          stage={m.manner.stage}
                          color={m.manner.avatarColor}
                          accessory={m.manner.avatarAccessory}
                          className="size-7"
                        />
                      )}
                    </div>
                  )}
                  <div className={cn('flex flex-col gap-0.5', m.isMine ? 'items-end' : 'items-start')}>
                    {showNickname && (
                      <span className="px-1 text-xs font-semibold text-muted-foreground">{m.senderNickname}</span>
                    )}
                    <div className={cn('group relative flex items-end gap-1.5', m.isMine ? 'flex-row-reverse' : 'flex-row')}>
                      <div
                        className={cn(
                          'max-w-64 rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                          isDeleted
                            ? 'border border-dashed border-border bg-transparent italic text-muted-foreground'
                            : m.isMine
                              ? 'rounded-br-sm bg-primary text-primary-foreground'
                              : 'rounded-bl-sm bg-muted text-foreground',
                        )}
                      >
                        {isDeleted ? '메시지가 삭제되었습니다' : m.content}
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-0.5">
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold leading-none text-primary">{unreadCount}</span>
                        )}
                        <span className="text-[11px] leading-none text-muted-foreground">{formatClock(m.createdAt)}</span>
                      </div>

                      {/* 타인 메시지 신고 버튼 (§7-1) */}
                      {!m.isMine && !isDeleted && (
                        <button
                          type="button"
                          onClick={() => openReportMessage(m)}
                          title="메시지 신고"
                          className="opacity-0 group-hover:opacity-100 transition p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Flag className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 5. 새 메시지 플로팅 버튼 (§5-4) */}
      {isScrolledUp && unreadNewCount > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-lg transition active:scale-95"
        >
          <span>새 메시지 {unreadNewCount}개</span>
          <ChevronDown className="size-4" />
        </button>
      )}

      {/* 6. 하단 메시지 입력창 (채팅 삭제 선택 모드에서는 삭제 액션 바로 대체) */}
      {selectMode ? (
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur">
          <button
            type="button"
            onClick={exitSelectMode}
            className="px-2 text-sm font-semibold text-muted-foreground"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => selectedIds.size > 0 && setDeleteConfirmOpen(true)}
            disabled={selectedIds.size === 0}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground transition active:scale-[0.98] disabled:opacity-40"
          >
            <Trash2 className="size-4" />
            삭제하기{selectedIds.size > 0 && ` (${selectedIds.size})`}
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="sticky bottom-0 flex flex-col gap-1 border-t border-border bg-background/95 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur"
        >
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive px-1">
              <AlertCircle className="size-3.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요 (최대 500자)"
              maxLength={500}
              className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="전송"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-[0.95] disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </div>
        </form>
      )}

      {/* 7. 모달들 */}
      {/* 신고 모달 */}
      {reportTarget && (
        <ReportModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          targetNickname={reportTarget.nickname}
          reportedUserId={reportTarget.userId}
          roomId={room.id}
          messageId={reportTarget.messageId}
        />
      )}

      {/* 안전 이용 안내 모달 (§5-1) */}
      <Dialog open={safetyGuideOpen} onOpenChange={setSafetyGuideOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600">
              <ShieldCheck className="size-5" />
              <DialogTitle className="text-base font-bold">안전 이용 안내</DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">🛡️ 먹메이트 안전 거래 수칙</p>
            <ul className="list-disc space-y-1.5 pl-4">
              <li>학교 내 지정된 수령 장소 등 공개된 장소에서 음식을 수령하세요.</li>
              <li>주문 메뉴, 금액, 수령 방법을 사전에 참여자들과 투명하게 조율해 주세요.</li>
              <li>불필요한 개인정보(주소, 전화번호 등)를 전달하지 마세요.</li>
              <li>부적절한 발언이나 불쾌한 문제 발생 시 메시지 또는 상단 더보기 메뉴에서 상대방을 신고할 수 있습니다.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setSafetyGuideOpen(false)} className="h-11 w-full rounded-xl font-bold">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 채팅 삭제 확인 모달 — 5분 이내 내 메시지만 전체 삭제, 그 외는 나만 안 보이게 삭제됨을 안내 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !deleting && setDeleteConfirmOpen(open)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold leading-snug">
              {allSelectedRealDelete
                ? '선택한 메시지를 삭제할까요?'
                : '해당 채팅은 나만 안보이게 삭제됩니다. 삭제하시겠습니까?'}
            </DialogTitle>
          </DialogHeader>
          {allSelectedRealDelete && (
            <p className="text-xs text-muted-foreground">
              삭제하면 되돌릴 수 없고, 상대방에게는 &quot;메시지가 삭제되었습니다&quot;로 보여요.
            </p>
          )}
          <DialogFooter className="mt-3 flex-row gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              className="h-11 flex-1 rounded-xl font-bold"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="h-11 flex-1 rounded-xl font-bold"
            >
              {deleting ? '삭제하는 중...' : '확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DateDivider({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {formatDateDivider(iso)}
      </span>
    </div>
  )
}
