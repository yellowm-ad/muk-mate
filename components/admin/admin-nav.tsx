'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShieldAlert, ShoppingBag, Users } from 'lucide-react'

import { cn } from '@/lib/utils'

const TABS = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/admin/reports', label: '신고함', icon: ShieldAlert, exact: false },
  { href: '/admin/pots', label: '모집글 관리', icon: ShoppingBag, exact: false },
  { href: '/admin/users', label: '회원 관리', icon: Users, exact: false },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
