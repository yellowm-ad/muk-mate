import type { ReactNode } from 'react'
import { MobileFrame } from '@/components/mobile-frame'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <MobileFrame>{children}</MobileFrame>
}
