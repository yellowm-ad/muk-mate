export type ViewerState =
  | 'HOST'          // 내가 방장
  | 'MEMBER'        // 승인된 참여자 (APPROVED)
  | 'PENDING'       // 신청하고 승인 대기 중 (PENDING)
  | 'REJECTED'      // 신청 거절당함 (REJECTED)
  | 'JOINABLE'      // 로그인 상태이며 참여 신청 가능
  | 'FULL'          // 정원 찼음
  | 'CLOSED'        // 모집 마감/종료됨 (OPEN이 아님)
  | 'GUEST'         // 비로그인
