'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/empty-state'
import { updateReportStatus, updateUserAccountStatus } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import type { AdminReportItem } from '@/lib/admin/data'
import type { ReportStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

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

const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: '대기중',
  REVIEWING: '검토중',
  RESOLVED: '처리완료',
  DISMISSED: '기각',
}

const FILTERS: { key: ReportStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'PENDING', label: '대기중' },
  { key: 'REVIEWING', label: '검토중' },
  { key: 'RESOLVED', label: '처리완료' },
  { key: 'DISMISSED', label: '기각' },
]

export function ReportsView({ reports }: { reports: AdminReportItem[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<ReportStatus | 'ALL'>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const visible = useMemo(
    () => (filter === 'ALL' ? reports : reports.filter((r) => r.status === filter)),
    [reports, filter],
  )

  return (
    <div className="flex flex-1 flex-col">
      <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-border bg-background px-4 py-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition',
              filter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Inbox} title="해당하는 신고가 없어요" description="다른 상태 필터를 선택해보세요." />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {visible.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              expanded={expandedId === r.id}
              onToggle={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReportRow({
  report,
  expanded,
  onToggle,
  onChanged,
}: {
  report: AdminReportItem
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [adminNote, setAdminNote] = useState(report.adminNote ?? '')
  const [busy, setBusy] = useState(false)

  async function handleStatusChange(status: 'REVIEWING' | 'RESOLVED' | 'DISMISSED') {
    setBusy(true)
    try {
      await updateReportStatus(report.id, { status, adminNote })
      onChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSuspend() {
    if (!report.reportedUser) return
    if (!confirm(`${report.reportedUser.nickname} 님의 계정을 정지하시겠습니까?`)) return
    setBusy(true)
    try {
      await updateUserAccountStatus(report.reportedUser.id, 'SUSPENDED')
      onChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReactivate() {
    if (!report.reportedUser) return
    if (!confirm(`${report.reportedUser.nickname} 님의 계정 정지를 해제하시겠습니까?`)) return
    setBusy(true)
    try {
      await updateUserAccountStatus(report.reportedUser.id, 'ACTIVE')
      onChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리에 실패했어요.')
    } finally {
      setBusy(false)
    }
  }

  const isSuspended = report.reportedUser?.accountStatus === 'SUSPENDED'
  const isDisabled = report.reportedUser?.accountStatus === 'DISABLED'

  return (
    <Card className={cn('overflow-hidden transition', report.status === 'PENDING' && 'border-destructive/30')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-4 text-left transition hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-bold',
                report.status === 'PENDING' && 'bg-destructive/10 text-destructive',
                report.status === 'REVIEWING' && 'bg-status-ordered/12 text-status-ordered',
                (report.status === 'RESOLVED' || report.status === 'DISMISSED') &&
                  'bg-muted text-muted-foreground',
              )}
            >
              {STATUS_LABELS[report.status]}
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {REASON_LABELS[report.reason] ?? report.reason}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {report.reporter?.nickname ?? '알 수 없음'} → {report.reportedUser?.nickname ?? '알 수 없음'}
            {isSuspended && ' · 정지됨'}
            {isDisabled && ' · 비활성화됨'}
            {' · '}
            {formatDateTime(report.createdAt)}
          </p>
        </div>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border bg-muted/30 p-4">
          {report.detail && <p className="text-sm text-foreground">{report.detail}</p>}
          {report.messageContentSnapshot && (
            <div className="rounded-lg border border-border bg-background p-2.5">
              <p className="text-xs font-semibold text-muted-foreground">신고된 메시지</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{report.messageContentSnapshot}</p>
            </div>
          )}

          <Textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="처리 메모 (선택)"
            className="min-h-16 text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleStatusChange('REVIEWING')}>
              검토중으로
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleStatusChange('RESOLVED')}>
              처리완료
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleStatusChange('DISMISSED')}>
              기각
            </Button>
            {report.reportedUser && !isSuspended && (
              <Button size="sm" variant="destructive" disabled={busy} onClick={handleSuspend}>
                이 유저 정지
              </Button>
            )}
            {report.reportedUser && isSuspended && (
              <Button size="sm" variant="outline" disabled={busy} onClick={handleReactivate}>
                정지 해제
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
