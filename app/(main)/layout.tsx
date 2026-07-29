import type { ReactNode } from 'react'
import { MobileFrame } from '@/components/mobile-frame'

export default function MainLayout({ children }: { children: ReactNode }) {
  return <MobileFrame withNav>{children}</MobileFrame>
}
