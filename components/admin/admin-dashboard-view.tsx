'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ShieldAlert, ShoppingBag, Users } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StoreAvatar } from '@/components/store-avatar'
import { zoneLabel } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'
import type { AdminDashboardData, AdminUserItem } from '@/lib/admin/data'

const SECTIONS = [
  {
    href: '/admin/reports',
    icon: ShieldAlert,
    title: '신고함',
    description: '접수된 신고를 검토하고 처리해요',
  },
  {
    href: '/admin/pots',
    icon: ShoppingBag,
    title: '모집글 관리',
    description: '전체 모집글을 검색하고 직권 삭제해요',
  },
  {
    href: '/admin/users',
    icon: Users,
    title: '회원 관리',
    description: '회원을 검색하고 계정 상태를 바꿔요',
  },
] as const

const REASON_LABELS: Record<string, string> = {
  HARASSMENT: '욕설·비방·괴롭힘',
  SEXUAL_CONTENT: '성적·불쾌한 내용',
  SPAM: '도배·광고·스팸',
  FRAUD: '사기·입금 관련 문제',
  NO_SHOW: '노쇼·거래 불이행',
  PRIVACY: '개인정보 요구·노출',
  UNSAFE_MEETING: '위험한 만남 또는 장소 요구',
  OTHER: '기타',
}

type DialogKey = 'todaySignups' | 'todayActiveUsers' | 'pendingReports' | 'suspendedUsers' | 'openPots' | 'allUsers'

export function AdminDashboardView({ data }: { data: AdminDashboardData }) {
  const [openDialog, setOpenDialog] = useState<DialogKey | null>(null)
  const close = () => setOpenDialog(null)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="오늘 가입한 회원"
          value={data.stats.todaySignupsCount}
          tone="primary"
          onClick={() => setOpenDialog('todaySignups')}
        />
        <StatTile
          label="오늘 접속한 회원"
          value={data.stats.todayActiveUsersCount}
          tone="primary"
          onClick={() => setOpenDialog('todayActiveUsers')}
        />
        <StatTile
          label="대기중인 신고"
          value={data.stats.pendingReportsCount}
          tone="destructive"
          onClick={() => setOpenDialog('pendingReports')}
        />
        <StatTile
          label="정지된 회원"
          value={data.stats.suspendedUsersCount}
          tone="ordered"
          onClick={() => setOpenDialog('suspendedUsers')}
        />
        <StatTile
          label="모집 중인 주문"
          value={data.stats.openPotsCount}
          tone="primary"
          onClick={() => setOpenDialog('openPots')}
        />
        <StatTile
          label="전체 회원 수"
          value={data.stats.totalUsersCount}
          tone="muted"
          onClick={() => setOpenDialog('allUsers')}
        />
      </div>

      <div className="flex flex-col gap-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.href} href={s.href} className="block transition active:scale-[0.99]">
              <Card className="flex items-center gap-3 p-4 hover:border-primary/40">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          )
        })}
      </div>

      <UserListDialog
        open={openDialog === 'todaySignups'}
        onOpenChange={close}
        title="오늘 가입한 회원"
        users={data.todaySignups}
        emptyText="오늘 가입한 회원이 없어요"
        dateFor={(u) => `가입 ${formatDateTime(u.createdAt)}`}
      />
      <UserListDialog
        open={openDialog === 'todayActiveUsers'}
        onOpenChange={close}
        title="오늘 접속한 회원"
        users={data.todayActiveUsers}
        emptyText="오늘 접속한 회원이 없어요"
        dateFor={(u) => (u.lastLoginAt ? `접속 ${formatDateTime(u.lastLoginAt)}` : null)}
      />
      <UserListDialog
        open={openDialog === 'suspendedUsers'}
        onOpenChange={close}
        title="정지된 회원"
        users={data.suspendedUsers}
        emptyText="정지된 회원이 없어요"
        dateFor={(u) => `가입 ${formatDateTime(u.createdAt)}`}
      />
      <UserListDialog
        open={openDialog === 'allUsers'}
        onOpenChange={close}
        title="전체 회원"
        users={data.allUsers}
        emptyText="가입한 회원이 없어요"
        dateFor={(u) => `가입 ${formatDateTime(u.createdAt)}`}
      />

      <Dialog open={openDialog === 'pendingReports'} onOpenChange={close}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>대기중인 신고 ({data.pendingReports.length}건)</DialogTitle>
          </DialogHeader>
          {data.pendingReports.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">대기중인 신고가 없어요</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.pendingReports.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-destructive">{REASON_LABELS[r.reason] ?? r.reason}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-foreground">
                    {r.reporter?.nickname ?? '알 수 없음'} → {r.reportedUser?.nickname ?? '알 수 없음'}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/admin/reports"
            onClick={close}
            className="mt-1 text-center text-xs font-semibold text-primary underline underline-offset-2"
          >
            신고함에서 처리하기
          </Link>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === 'openPots'} onOpenChange={close}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>모집 중인 주문 ({data.openPots.length}건)</DialogTitle>
          </DialogHeader>
          {data.openPots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">모집 중인 주문이 없어요</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.openPots.map((p) => (
                <Link
                  key={p.id}
                  href={`/pots/${p.id}`}
                  onClick={close}
                  className="block rounded-lg border border-border p-2.5 transition hover:border-primary/40"
                >
                  <p className="truncate text-sm font-semibold text-foreground">{p.storeName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.hostNickname} · {zoneLabel(p.zoneCode)} · 마감 {formatDateTime(p.deadlineAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/admin/pots"
            onClick={close}
            className="mt-1 text-center text-xs font-semibold text-primary underline underline-offset-2"
          >
            모집글 관리에서 보기
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserListDialog({
  open,
  onOpenChange,
  title,
  users,
  emptyText,
  dateFor,
}: {
  open: boolean
  onOpenChange: () => void
  title: string
  users: AdminUserItem[]
  emptyText: string
  dateFor: (u: AdminUserItem) => string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title} ({users.length}명)
          </DialogTitle>
        </DialogHeader>
        {users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((u) => {
              const dateText = dateFor(u)
              return (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <StoreAvatar name={u.nickname} className="size-9 shrink-0 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {u.nickname} <span className="font-normal text-muted-foreground">@{u.loginId}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {zoneLabel(u.zoneCode)}
                      {dateText ? ` · ${dateText}` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <Link
          href="/admin/users"
          onClick={onOpenChange}
          className="mt-1 text-center text-xs font-semibold text-primary underline underline-offset-2"
        >
          회원 관리에서 보기
        </Link>
      </DialogContent>
    </Dialog>
  )
}

function StatTile({
  label,
  value,
  tone,
  onClick,
}: {
  label: string
  value: number
  tone: 'destructive' | 'ordered' | 'primary' | 'muted'
  onClick: () => void
}) {
  const toneClass = {
    destructive: 'text-destructive',
    ordered: 'text-status-ordered',
    primary: 'text-primary',
    muted: 'text-foreground',
  }[tone]

  return (
    <button type="button" onClick={onClick} className="block w-full text-left transition active:scale-[0.98]">
      <Card className="p-4 hover:border-primary/40">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-extrabold tabular-nums ${toneClass}`}>{value}</p>
      </Card>
    </button>
  )
}
