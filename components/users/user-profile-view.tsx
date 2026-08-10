'use client'

import { useState } from 'react'
import { ShieldAlert, ShoppingBag } from 'lucide-react'

import { AppHeader } from '@/components/app-header'
import { ReportModal } from '@/components/chat/report-modal'
import { MannerAvatar } from '@/components/manner-avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MANNER_STAGE_LABELS } from '@/lib/manner-constants'
import type { MannerProfile } from '@/lib/types'

export function UserProfileView({
  profile,
}: {
  profile: { id: string; nickname: string; manner: MannerProfile; completedPotCount: number }
}) {
  const [reportOpen, setReportOpen] = useState(false)

  return (
    <>
      <AppHeader title="프로필" showBack />

      <div className="flex flex-col items-center gap-3 border-b border-border bg-card px-4 py-8">
        <MannerAvatar stage={profile.manner.stage} size={88} />
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{profile.nickname}</p>
          <p className="mt-1 text-sm font-semibold text-primary">
            {profile.manner.score !== null ? `매너 포만도 ${Math.round(profile.manner.score)}점 · ` : ''}
            {MANNER_STAGE_LABELS[profile.manner.stage]}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ShoppingBag className="size-4 text-primary" />
            완료한 공동주문
          </div>
          <span className="text-base font-bold text-foreground">{profile.completedPotCount}회</span>
        </Card>

        <Button
          variant="outline"
          onClick={() => setReportOpen(true)}
          className="h-11 gap-1.5 rounded-xl border-destructive/40 font-bold text-destructive hover:bg-destructive/5"
        >
          <ShieldAlert className="size-4" />
          신고하기
        </Button>
      </div>

      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetNickname={profile.nickname}
        reportedUserId={profile.id}
      />
    </>
  )
}
