'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { sendReport } from '@/lib/api'
import type { ReportReason } from '@/lib/types'
import { cn } from '@/lib/utils'

const REPORT_REASONS: { code: ReportReason; label: string }[] = [
  { code: 'HARASSMENT', label: '욕설·비방·괴롭힘' },
  { code: 'SEXUAL_CONTENT', label: '성적·불쾌한 내용' },
  { code: 'SPAM', label: '도배·광고·스팸' },
  { code: 'FRAUD', label: '사기·입금 관련 문제' },
  { code: 'NO_SHOW', label: '노쇼·거래 불이행' },
  { code: 'PRIVACY', label: '개인정보 요구·노출' },
  { code: 'UNSAFE_MEETING', label: '위험한 만남 또는 장소 요구' },
  { code: 'OTHER', label: '기타' },
]

export function ReportModal({
  open,
  onOpenChange,
  targetNickname,
  reportedUserId,
  roomId,
  messageId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetNickname: string
  reportedUserId: string
  roomId?: string
  messageId?: number
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleClose() {
    onOpenChange(false)
    // reset state after animation delay
    setTimeout(() => {
      setReason(null)
      setDetail('')
      setError(null)
      setSubmitted(false)
    }, 200)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) {
      setError('신고 사유를 선택해 주세요.')
      return
    }
    if (reason === 'OTHER' && !detail.trim()) {
      setError("'기타' 사유 선택 시 상세 내용을 작성해 주세요.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await sendReport({
        reportedUserId,
        roomId,
        messageId,
        reason,
        detail: detail.trim(),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '신고 접수에 실패했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {submitted ? (
          /* 신고 완료 화면 (§7-4) */
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="size-6" />
            </div>
            <DialogTitle className="text-lg font-bold">신고가 접수되었습니다</DialogTitle>
            <DialogDescription className="mt-2 text-xs leading-relaxed text-muted-foreground">
              운영자가 내용을 확인한 후 필요한 조치를 진행합니다.
              <br />
              <strong className="font-semibold text-foreground">신고자의 정보는 상대방에게 공개되지 않습니다.</strong>
            </DialogDescription>
            <Button onClick={handleClose} className="mt-6 h-11 w-full rounded-xl font-bold">
              확인
            </Button>
          </div>
        ) : (
          /* 신고 작성 폼 (§7-2) */
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <div className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="size-5" />
                <DialogTitle className="text-lg font-bold">신고하기</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                신고 대상: <span className="font-bold text-foreground">{targetNickname}</span>
                {messageId ? ' (메시지 신고)' : ' (사용자 신고)'}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-muted-foreground">신고 사유를 선택해 주세요.</label>
              <div className="flex flex-col gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => {
                      setReason(r.code)
                      setError(null)
                    }}
                    className={cn(
                      'flex h-10 items-center justify-between rounded-xl border px-3 text-xs font-semibold transition text-left',
                      reason === r.code
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground hover:bg-muted/50',
                    )}
                  >
                    <span>{r.label}</span>
                    {reason === r.code && <span className="size-2 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                상세 내용 {reason === 'OTHER' ? '(필수)' : '(선택)'}
              </label>
              <Textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="상황을 구체적으로 설명해 주세요 (최대 500자)"
                maxLength={500}
                className="min-h-[80px] rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
                className="h-11 flex-1 rounded-xl font-bold"
              >
                취소
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={submitting || !reason}
                className="h-11 flex-1 rounded-xl font-bold"
              >
                {submitting ? '접수하는 중...' : '신고 접수'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
