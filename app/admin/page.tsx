import Link from 'next/link'
import { ChevronRight, ShieldAlert, ShoppingBag, Users } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { getAdminDashboardStats } from '@/lib/admin/data'

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

export default async function AdminHomePage() {
  const stats = await getAdminDashboardStats()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="대기중인 신고" value={stats.pendingReportsCount} tone="destructive" />
        <StatTile label="정지된 회원" value={stats.suspendedUsersCount} tone="ordered" />
        <StatTile label="모집 중인 주문" value={stats.openPotsCount} tone="primary" />
        <StatTile label="전체 회원 수" value={stats.totalUsersCount} tone="muted" />
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
    </div>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'destructive' | 'ordered' | 'primary' | 'muted'
}) {
  const toneClass = {
    destructive: 'text-destructive',
    ordered: 'text-status-ordered',
    primary: 'text-primary',
    muted: 'text-foreground',
  }[tone]

  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${toneClass}`}>{value}</p>
    </Card>
  )
}
