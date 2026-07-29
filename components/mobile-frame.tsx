import type { ReactNode } from 'react'
import { BottomNav } from '@/components/bottom-nav'

/**
 * 모바일 우선 프레임.
 * 데스크톱에서는 max-w-[430px]로 가운데 정렬하고 좌우에 연회색(surface) 배경을 둬서
 * 모바일 프레임처럼 보이게 한다.
 */
export function MobileFrame({
  children,
  withNav = false,
}: {
  children: ReactNode
  withNav?: boolean
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background shadow-[0_0_60px_rgba(0,0,0,0.06)]">
      <div className="flex flex-1 flex-col">{children}</div>
      {withNav && <BottomNav />}
    </div>
  )
}
