'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatWon } from '@/lib/format'

interface JoinConfirmSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (menuMemo: string, menuAmount: number) => Promise<void>
  /** 참여 신청 화면에서 바로 확인할 수 있어야 하는 총 배달비(§5-4) — 수령 정보에도 나오지만 여기서 놓치기 쉽다 */
  deliveryFee: number
}

export function JoinConfirmSheet({ isOpen, onClose, onSubmit, deliveryFee }: JoinConfirmSheetProps) {
  const [menuMemo, setMenuMemo] = useState('')
  const [menuAmount, setMenuAmount] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(menuMemo.trim(), menuAmount)
      setMenuMemo('')
      setMenuAmount(0)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '참여 신청에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-[430px] rounded-t-2xl bg-background p-5 shadow-2xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-foreground">같이 주문할까요?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          방장이 수락하면 참여가 확정돼요.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="menuMemo" className="block text-xs font-semibold text-muted-foreground">
              메뉴 메모 (선택)
            </label>
            <Textarea
              id="menuMemo"
              value={menuMemo}
              onChange={(e) => setMenuMemo(e.target.value)}
              placeholder="예: 제육덮밥 1개, 매운맛으로 해주세요"
              maxLength={100}
              className="mt-1.5 min-h-[80px] rounded-xl border-border text-sm"
            />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">
              {menuMemo.length} / 100자
            </div>
          </div>

          <div>
            <label htmlFor="menuAmount" className="block text-xs font-semibold text-muted-foreground">
              내 주문 금액 (선택, 원)
            </label>
            <Input
              id="menuAmount"
              type="number"
              min={0}
              step={500}
              value={menuAmount}
              onChange={(e) => setMenuAmount(Number(e.target.value))}
              className="mt-1.5 h-11 rounded-xl"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              총 배달비 {formatWon(deliveryFee)} · 참여 인원으로 나눠서 부담해요.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="h-12 flex-1 rounded-xl text-base font-bold"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-12 flex-1 rounded-xl text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? '신청 중...' : '참여 신청'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
