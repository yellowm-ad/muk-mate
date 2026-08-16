import 'server-only'

import { count, desc, eq, inArray, sql } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { pots, reports, users } from '@/lib/db/schema'
import { listPots } from '@/lib/server-data'
import type { AccountStatus, Pot, ReportReason, ReportStatus, UserRole, ZoneCode } from '@/lib/types'

export interface AdminReportItem {
  id: string
  reason: ReportReason
  detail: string | null
  status: ReportStatus
  adminNote: string | null
  reviewedAt: string | null
  createdAt: string
  messageContentSnapshot: string | null
  messageCreatedSnapshot: string | null
  reporter: { id: string; nickname: string; loginId: string } | null
  reportedUser: { id: string; nickname: string; loginId: string; accountStatus: string } | null
}

/** 관리자 신고함 초기 목록 — PENDING/REVIEWING 우선, 그다음 최신순 */
export async function getReportsForAdmin(): Promise<AdminReportItem[]> {
  const db = getDb()

  const rows = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      detail: reports.detail,
      status: reports.status,
      adminNote: reports.adminNote,
      reviewedAt: reports.reviewedAt,
      createdAt: reports.createdAt,
      messageContentSnapshot: reports.messageContentSnapshot,
      messageCreatedSnapshot: reports.messageCreatedSnapshot,
      reporterId: reports.reporterId,
      reportedUserId: reports.reportedUserId,
    })
    .from(reports)
    .orderBy(
      sql`CASE ${reports.status} WHEN 'PENDING' THEN 0 WHEN 'REVIEWING' THEN 1 ELSE 2 END`,
      desc(reports.createdAt),
    )

  const userIds = Array.from(new Set(rows.flatMap((r) => [r.reporterId, r.reportedUserId])))
  const userRows = userIds.length
    ? await db
        .select({ id: users.id, nickname: users.nickname, loginId: users.loginId, accountStatus: users.accountStatus })
        .from(users)
        .where(inArray(users.id, userIds))
    : []
  const userMap = new Map(userRows.map((u) => [u.id, u]))

  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    detail: r.detail,
    status: r.status,
    adminNote: r.adminNote,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    messageContentSnapshot: r.messageContentSnapshot,
    messageCreatedSnapshot: r.messageCreatedSnapshot?.toISOString() ?? null,
    reporter: userMap.get(r.reporterId) ?? null,
    reportedUser: userMap.get(r.reportedUserId) ?? null,
  }))
}

export interface AdminUserItem {
  id: string
  loginId: string
  nickname: string
  zoneCode: ZoneCode
  role: UserRole
  accountStatus: AccountStatus
  createdAt: string
  lastLoginAt: string | null
  // 전북대 이메일 인증(신규) — 관리자 화면에서만 노출한다. 기존 계정은 null.
  jbnuEmail: string | null
  jbnuEmailVerifiedAt: string | null
}

/** 표시는 항상 KST 기준(§9-3)이라 "오늘"의 경계도 KST 자정으로 계산 — 서버(UTC)의 달력일과 어긋나지 않게 */
function kstTodayStartUtc(): Date {
  const now = new Date()
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const kstMidnightAsUtcMs = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 60 * 60 * 1000
  return new Date(kstMidnightAsUtcMs)
}

/** 관리자 회원 목록 — 최신 가입순 */
export async function getUsersForAdmin(): Promise<AdminUserItem[]> {
  const db = getDb()

  const rows = await db
    .select({
      id: users.id,
      loginId: users.loginId,
      nickname: users.nickname,
      zoneCode: users.zoneCode,
      role: users.role,
      accountStatus: users.accountStatus,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      jbnuEmail: users.jbnuEmail,
      jbnuEmailVerifiedAt: users.jbnuEmailVerifiedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  return rows.map((r) => ({
    id: r.id,
    loginId: r.loginId,
    nickname: r.nickname,
    zoneCode: r.zoneCode as ZoneCode,
    role: r.role as UserRole,
    accountStatus: r.accountStatus as AccountStatus,
    createdAt: r.createdAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    jbnuEmail: r.jbnuEmail,
    jbnuEmailVerifiedAt: r.jbnuEmailVerifiedAt?.toISOString() ?? null,
  }))
}

export interface AdminDashboardStats {
  pendingReportsCount: number
  totalUsersCount: number
  suspendedUsersCount: number
  totalPotsCount: number
  openPotsCount: number
  todaySignupsCount: number
  todayActiveUsersCount: number
}

export interface AdminDashboardData {
  stats: AdminDashboardStats
  /** 오늘(KST) 가입한 회원 — 최신순 */
  todaySignups: AdminUserItem[]
  /** 오늘(KST) 로그인한 회원 — 최근 접속순 */
  todayActiveUsers: AdminUserItem[]
  /** 처리 대기중인 신고 */
  pendingReports: AdminReportItem[]
  /** 정지된 회원 */
  suspendedUsers: AdminUserItem[]
  /** 모집 중(OPEN, 마감시각 지나지 않음)인 모집글 — 조회 시점 판정(§10-3③) 반영 */
  openPots: Pot[]
  /** 전체 회원 — 최신 가입순 */
  allUsers: AdminUserItem[]
}

/** 관리자 랜딩 대시보드 — 요약 카운트 + 각 카운트를 누르면 보여줄 상세 목록.
 *  이미 화면(회원관리/신고함/모집글관리)에 쓰는 조회 함수를 그대로 재사용해서,
 *  대시보드 숫자와 상세 목록이 항상 같은 기준(특히 모집글의 마감시각 조회 시점 판정)으로 일치하게 한다. */
export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const todayStart = kstTodayStartUtc()

  const [allUsers, allReports, openPots, [{ cnt: totalPotsCount }]] = await Promise.all([
    getUsersForAdmin(),
    getReportsForAdmin(),
    listPots({ status: 'OPEN' }),
    getDb().select({ cnt: count() }).from(pots),
  ])

  const todaySignups = allUsers.filter((u) => new Date(u.createdAt) >= todayStart)
  const todayActiveUsers = allUsers
    .filter((u) => u.lastLoginAt && new Date(u.lastLoginAt) >= todayStart)
    .sort((a, b) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime())
  const pendingReports = allReports.filter((r) => r.status === 'PENDING')
  const suspendedUsers = allUsers.filter((u) => u.accountStatus === 'SUSPENDED')

  return {
    stats: {
      pendingReportsCount: pendingReports.length,
      totalUsersCount: allUsers.length,
      suspendedUsersCount: suspendedUsers.length,
      totalPotsCount,
      openPotsCount: openPots.length,
      todaySignupsCount: todaySignups.length,
      todayActiveUsersCount: todayActiveUsers.length,
    },
    todaySignups,
    todayActiveUsers,
    pendingReports,
    suspendedUsers,
    openPots,
    allUsers,
  }
}
