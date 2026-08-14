'use client'

import Link from 'next/link'
import { Bell, ChevronRight, Shield, Users } from 'lucide-react'
import { AppHeader } from '@/components/app-header'

const ITEMS = [
  { href: '/my/settings/notifications', icon: Bell, label: '알림 설정' },
  { href: '/my/settings/friends', icon: Users, label: '친구 설정' },
  { href: '/my/settings/security', icon: Shield, label: '보안 설정' },
] as const

export function SettingsView() {
  return (
    <>
      <AppHeader title="환경설정" showBack />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex h-12 items-center justify-between px-4 text-sm font-semibold text-foreground transition hover:bg-muted/50 active:bg-muted"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="size-4 text-muted-foreground" />
                <span>{label}</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
