'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, ShoppingBag, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/pots', label: '공동주문', icon: ShoppingBag, match: '/pots' },
  { href: '/chat', label: '채팅', icon: MessageCircle, match: '/chat' },
  { href: '/my', label: '마이', icon: User, match: '/my' },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active = pathname === tab.match || pathname.startsWith(tab.match + '/')
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition active:scale-[0.96]',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('size-6', active && 'fill-primary/10')} strokeWidth={active ? 2.4 : 2} />
                <span>{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
