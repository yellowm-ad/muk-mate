'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { StoreAvatar } from '@/components/store-avatar'
import { updateUserAccountStatus } from '@/lib/api'
import { zoneLabel } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'
import type { AdminUserItem } from '@/lib/admin/data'
import type { AccountStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: '정상',
  SUSPENDED: '정지',
  DISABLED: '비활성화',
}

const STATUS_FILTERS: { key: AccountStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'ACTIVE', label: '정상' },
  { key: 'SUSPENDED', label: '정지' },
  { key: 'DISABLED', label: '비활성화' },
]

export function AdminUsersView({
  users,
  currentAdminId,
}: {
  users: AdminUserItem[]
  currentAdminId: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'ALL'>('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = useMemo(() => {
    let list = users
    if (statusFilter !== 'ALL') list = list.filter((u) => u.accountStatus === statusFilter)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((u) => u.loginId.toLowerCase().includes(q) || u.nickname.toLowerCase().includes(q))
    return list
  }, [users, query, statusFilter])

  async function handleChangeStatus(user: AdminUserItem, next: AccountStatus) {
    if (!confirm(`${user.nickname}(${user.loginId}) 님의 계정 상태를 "${STATUS_LABELS[next]}"(으)로 변경하시겠습니까?`)) return
    setBusyId(user.id)
    try {
      await updateUserAccountStatus(user.id, next)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리에 실패했어요.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="아이디·닉네임으로 검색"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition',
              statusFilter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Users} title="해당하는 회원이 없어요" description="다른 검색어나 필터를 선택해보세요." />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {visible.map((u) => (
            <Card key={u.id} className="flex items-center gap-3 p-3.5">
              <StoreAvatar name={u.nickname} className="size-11 shrink-0 text-base" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-bold',
                      u.accountStatus === 'ACTIVE' && 'bg-muted text-muted-foreground',
                      u.accountStatus === 'SUSPENDED' && 'bg-destructive/10 text-destructive',
                      u.accountStatus === 'DISABLED' && 'bg-status-ordered/12 text-status-ordered',
                    )}
                  >
                    {STATUS_LABELS[u.accountStatus]}
                  </span>
                  {u.role === 'ADMIN' && (
                    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-primary-soft px-2 text-xs font-bold text-primary">
                      관리자
                    </span>
                  )}
                  <span className="truncate text-sm font-semibold text-foreground">
                    {u.nickname} <span className="font-normal text-muted-foreground">@{u.loginId}</span>
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {zoneLabel(u.zoneCode)} · 가입 {formatDateTime(u.createdAt)}
                </p>
              </div>

              {u.id === currentAdminId ? (
                <span className="shrink-0 text-xs text-muted-foreground">나</span>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  {u.accountStatus !== 'SUSPENDED' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyId === u.id}
                      onClick={() => handleChangeStatus(u, 'SUSPENDED')}
                    >
                      정지
                    </Button>
                  )}
                  {u.accountStatus !== 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === u.id}
                      onClick={() => handleChangeStatus(u, 'ACTIVE')}
                    >
                      정상화
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
