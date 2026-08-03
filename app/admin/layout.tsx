import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

import { AdminNav } from '@/components/admin/admin-nav'
import { requireAdmin } from '@/lib/admin/auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <span className="text-base font-bold text-foreground">먹메이트 관리자</span>
        </div>
        <span className="text-sm text-muted-foreground">{admin.nickname}</span>
      </header>
      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur">
        <AdminNav />
      </div>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
