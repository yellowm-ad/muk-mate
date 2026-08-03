import type { ViewerState } from '@/types/pot-member'
import type { PotStatus } from '@/lib/types'

export function resolveViewerState(input: {
  userId?: string | null
  hostId: string
  potStatus: PotStatus
  myApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  approvedCount: number
  maxPeople: number
}): ViewerState {
  const { userId, hostId, potStatus, myApprovalStatus, approvedCount, maxPeople } = input

  // 1. 비로그인
  if (!userId) {
    return 'GUEST'
  }

  // 2. 내가 방장
  if (userId === hostId) {
    return 'HOST'
  }

  // 3. 내 신청 상태별 판정
  if (myApprovalStatus === 'APPROVED') {
    return 'MEMBER'
  }
  if (myApprovalStatus === 'PENDING') {
    return 'PENDING'
  }
  if (myApprovalStatus === 'REJECTED') {
    return 'REJECTED'
  }

  // 4. 모집중이 아님 (OPEN이 아님)
  if (potStatus !== 'OPEN') {
    return 'CLOSED'
  }

  // 5. 정원 초과
  if (approvedCount >= maxPeople) {
    return 'FULL'
  }

  // 6. 참여 가능
  return 'JOINABLE'
}
