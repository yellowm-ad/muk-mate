'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import {
  ChevronRight,
  Clock,
  FileText,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  ShoppingBag,
  User,
  UserCheck,
  Users,
} from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { ApprovalBadge, PotStatusBadge } from '@/components/status-badge'
import { StoreAvatar } from '@/components/store-avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { zoneLabel } from '@/lib/constants'
import { formatDateTime, formatWon } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Participation, Pot, ZoneCode } from '@/lib/types'

export function MyPageView({
  me,
  hostedPots,
  applications,
}: {
  me: { nickname: string; zoneCode: ZoneCode }
  hostedPots: Pot[]
  applications: { participation: Participation; pot: Pot }[]
}) {
  const [tab, setTab] = useState<'HOSTED' | 'JOINED'>('HOSTED')
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [guideModalOpen, setGuideModalOpen] = useState(false)

  return (
    <>
      <AppHeader title="마이" />

      {/* 1. 프로필 카드 */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-4">
        <StoreAvatar name={me.nickname} className="size-12 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-foreground">{me.nickname}</p>
          <p className="text-sm text-muted-foreground">{zoneLabel(me.zoneCode)}</p>
        </div>
        <Link
          href="/my/edit"
          className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary transition hover:underline"
        >
          정보 수정
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* 2. 내 활동 요약 카드 */}
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="mb-2 text-xs font-bold text-muted-foreground">내 활동 요약</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTab('HOSTED')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition active:scale-[0.98]',
              tab === 'HOSTED'
                ? 'border-primary bg-primary/10 font-bold text-primary shadow-xs'
                : 'border-border bg-card text-foreground hover:bg-muted/50',
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">내가 만든 주문</span>
            <span className="mt-0.5 text-xl font-bold text-primary">{hostedPots.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('JOINED')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border p-3 text-center transition active:scale-[0.98]',
              tab === 'JOINED'
                ? 'border-primary bg-primary/10 font-bold text-primary shadow-xs'
                : 'border-border bg-card text-foreground hover:bg-muted/50',
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">참여 주문</span>
            <span className="mt-0.5 text-xl font-bold text-primary">{applications.length}</span>
          </button>
        </div>
      </div>

      {/* 3. 공동주문 내역 탭 */}
      <div className="flex border-b border-border bg-card px-4">
        <button
          type="button"
          onClick={() => setTab('HOSTED')}
          className={cn(
            'relative flex h-11 flex-1 items-center justify-center text-sm font-semibold transition',
            tab === 'HOSTED' ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          내가 만든 주문 ({hostedPots.length})
          {tab === 'HOSTED' && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
        </button>
        <button
          type="button"
          onClick={() => setTab('JOINED')}
          className={cn(
            'relative flex h-11 flex-1 items-center justify-center text-sm font-semibold transition',
            tab === 'JOINED' ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          참여한 주문 ({applications.length})
          {tab === 'JOINED' && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
        </button>
      </div>

      {/* 4. 공동주문 내역 목록 */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {tab === 'HOSTED' ? (
          hostedPots.length > 0 ? (
            hostedPots.map((pot) => (
              <Card key={pot.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <PotStatusBadge status={pot.status} />
                  {pot.pendingCount && pot.pendingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      <UserCheck className="size-3.5" />
                      신청자 {pot.pendingCount}명
                    </span>
                  ) : null}
                </div>

                <div>
                  <h3 className="line-clamp-1 text-base font-bold text-foreground">{pot.storeName}</h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{pot.orderSummary}</p>
                </div>

                <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{pot.pickupName}</span>
                  </div>
                  {pot.pickupAt && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5 shrink-0 text-primary" />
                      <span>{formatDateTime(pot.pickupAt)} 수령</span>
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-1 font-medium text-foreground">
                    <span>모집 인원/목표</span>
                    <span className="font-bold text-primary">
                      {pot.targetType === 'AMOUNT'
                        ? `${formatWon(pot.currentAmount ?? 0)} / ${formatWon(pot.targetValue)}`
                        : `${pot.currentCount} / ${pot.targetValue}명`}
                    </span>
                  </div>
                </div>

                {/* 모집자 액션 버튼 */}
                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/pots/${pot.id}`}
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'h-11 flex-1 rounded-xl text-xs font-bold',
                    )}
                  >
                    상세보기
                  </Link>
                  {pot.status === 'OPEN' && (
                    <Link
                      href={`/pots/${pot.id}/applications`}
                      className={cn(
                        buttonVariants({ variant: 'default' }),
                        'h-11 flex-1 rounded-xl text-xs font-bold',
                      )}
                    >
                      신청자 관리
                      {pot.pendingCount && pot.pendingCount > 0 ? ` (${pot.pendingCount})` : ''}
                    </Link>
                  )}
                  {pot.status === 'CLOSED' && pot.chatRoomId && (
                    <Link
                      href={`/chat/${pot.chatRoomId}`}
                      className={cn(
                        buttonVariants({ variant: 'default' }),
                        'h-11 flex-1 rounded-xl text-xs font-bold',
                      )}
                    >
                      <MessageCircle className="mr-1 size-3.5" />
                      채팅방 입장
                    </Link>
                  )}
                </div>
              </Card>
            ))
          ) : (
            /* 빈 화면 - 내가 만든 주문이 없는 경우 (§7-1) */
            <div className="my-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShoppingBag className="size-6" />
              </div>
              <p className="text-base font-bold text-foreground">아직 만든 공동주문이 없어요.</p>
              <p className="mt-1 text-xs text-muted-foreground">같이 주문할 사람을 직접 모아보세요.</p>
              <Link
                href="/pots/new"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'mt-4 h-11 rounded-xl px-5 font-bold',
                )}
              >
                <Plus className="mr-1 size-4" />
                공동주문 만들기
              </Link>
            </div>
          )
        ) : applications.length > 0 ? (
          applications.map(({ pot, participation }) => (
            <Card key={participation.id} className="flex flex-col gap-3 p-4">
              {/* 상태 구분 표시 (§5-3) */}
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">공동주문:</span>
                  <PotStatusBadge status={pot.status} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">나의 신청:</span>
                  <ApprovalBadge status={participation.approvalStatus} />
                </div>
              </div>

              <div>
                <h3 className="line-clamp-1 text-base font-bold text-foreground">{pot.storeName}</h3>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{pot.orderSummary}</p>
              </div>

              <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{pot.pickupName}</span>
                </div>
                {pot.pickupAt && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 shrink-0 text-primary" />
                    <span>{formatDateTime(pot.pickupAt)} 수령</span>
                  </div>
                )}
              </div>

              {/* 참여자 액션 버튼 */}
              <div className="flex gap-2 pt-1">
                <Link
                  href={`/pots/${pot.id}`}
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'h-11 flex-1 rounded-xl text-xs font-bold',
                  )}
                >
                  상세보기
                </Link>
                {participation.approvalStatus === 'APPROVED' && pot.chatRoomId && (
                  <Link
                    href={`/chat/${pot.chatRoomId}`}
                    className={cn(
                      buttonVariants({ variant: 'default' }),
                      'h-11 flex-1 rounded-xl text-xs font-bold',
                    )}
                  >
                    <MessageCircle className="mr-1 size-3.5" />
                    채팅방 입장
                  </Link>
                )}
              </div>
            </Card>
          ))
        ) : (
          /* 빈 화면 - 참여한 주문이 없는 경우 (§7-2) */
          <div className="my-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="size-6" />
            </div>
            <p className="text-base font-bold text-foreground">아직 참여한 공동주문이 없어요.</p>
            <p className="mt-1 text-xs text-muted-foreground">지금 모집 중인 주문을 확인해보세요.</p>
            <Link
              href="/pots"
              className={cn(
                buttonVariants({ variant: 'default' }),
                'mt-4 h-11 rounded-xl px-5 font-bold',
              )}
            >
              <Search className="mr-1 size-4" />
              모집 중인 주문 둘러보기
            </Link>
          </div>
        )}
      </div>

      {/* 5. 계정 관리 메뉴 (§6) */}
      <div className="mt-2 flex flex-col gap-3 border-t border-border p-4">
        <h2 className="text-sm font-bold text-muted-foreground">계정 관리</h2>
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <Link
            href="/my/edit"
            className="flex h-12 items-center justify-between px-4 text-sm font-semibold text-foreground transition hover:bg-muted/50 active:bg-muted"
          >
            <div className="flex items-center gap-2.5">
              <User className="size-4 text-muted-foreground" />
              <span>기본정보 수정</span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>

          <Link
            href="/my/edit"
            className="flex h-12 items-center justify-between px-4 text-sm font-semibold text-foreground transition hover:bg-muted/50 active:bg-muted"
          >
            <div className="flex items-center gap-2.5">
              <Lock className="size-4 text-muted-foreground" />
              <span>비밀번호 변경</span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>

          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            className="flex h-12 items-center justify-between px-4 text-left text-sm font-semibold text-foreground transition hover:bg-muted/50 active:bg-muted"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="size-4 text-muted-foreground" />
              <span>서비스 이용 안내</span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            className="flex h-12 items-center justify-between px-4 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/5 active:bg-destructive/10"
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="size-4 text-destructive" />
              <span>로그아웃</span>
            </div>
          </button>
        </div>
      </div>

      {/* 로그아웃 확인 모달 (§6) */}
      <Dialog open={logoutModalOpen} onOpenChange={setLogoutModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold">정말 로그아웃하시겠어요?</DialogTitle>
            <DialogDescription className="mt-1 text-center text-xs text-muted-foreground">
              로그아웃 시 다시 로그인할 때까지 공동주문 및 채팅 서비스를 이용할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 flex-row gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setLogoutModalOpen(false)}
              className="h-11 flex-1 rounded-xl font-bold"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                fetch('/api/auth/session-guard', { method: 'DELETE' })
                signOut({ callbackUrl: '/login' })
              }}
              className="h-11 flex-1 rounded-xl font-bold"
            >
              로그아웃
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 서비스 이용 안내 모달 (§6) */}
      <Dialog open={guideModalOpen} onOpenChange={setGuideModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">서비스 이용 안내</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">구조 및 서비스 규칙</p>
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>먹메이트는 전북대 대학생들이 함께 음식을 배달시켜 배달비를 절약하는 커뮤니티 플랫폼입니다.</li>
              <li>모집자는 참여 신청을 확인 및 승인하고, 약속된 장소에서 소통하여 음식을 전달합니다.</li>
              <li>참여자는 승인된 후 약속된 수령 장소와 시각을 엄수해 주세요.</li>
              <li>무단 취소나 노쇼(No-Show) 발생 시 이용 제한 조치가 취해질 수 있습니다.</li>
            </ol>
          </div>
          <DialogFooter>
            <Button onClick={() => setGuideModalOpen(false)} className="h-11 w-full rounded-xl font-bold">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
