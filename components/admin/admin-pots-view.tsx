'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ShoppingBag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { PotStatusBadge } from '@/components/status-badge'
import { StoreAvatar } from '@/components/store-avatar'
import { adminDeletePot } from '@/lib/api'
import { zoneLabel } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'
import type { Pot } from '@/lib/types'

export function AdminPotsView({ pots }: { pots: Pot[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pots
    return pots.filter(
      (p) =>
        p.storeName.toLowerCase().includes(q) ||
        p.orderSummary.toLowerCase().includes(q) ||
        p.hostNickname.toLowerCase().includes(q),
    )
  }, [pots, query])

  async function handleDelete(pot: Pot) {
    if (!confirm(`"${pot.storeName}" 모집글을 삭제하시겠습니까? 참여자·채팅 내역이 있어도 즉시 삭제되며 되돌릴 수 없습니다.`)) return
    setBusyId(pot.id)
    try {
      await adminDeletePot(pot.id)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했어요.')
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
          placeholder="가게 이름·메뉴·방장 닉네임으로 검색"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="해당하는 모집글이 없어요" description="다른 검색어로 찾아보세요." />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {visible.map((pot) => (
            <Card key={pot.id} className="flex items-center gap-3 p-3.5">
              <StoreAvatar name={pot.storeName} className="size-11 shrink-0 text-base" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <PotStatusBadge status={pot.status} />
                  <span className="truncate text-sm font-semibold text-foreground">{pot.storeName}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {zoneLabel(pot.zoneCode)} · {pot.hostNickname} · {pot.currentCount}/{pot.targetValue}명 ·{' '}
                  {formatDateTime(pot.createdAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={busyId === pot.id}
                onClick={() => handleDelete(pot)}
              >
                삭제
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
