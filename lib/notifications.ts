import { eq } from 'drizzle-orm'

import { notifications, userPreferences } from '@/lib/db/schema'
import type { NotificationType } from '@/lib/types'

export interface CreateNotificationInput {
  recipientId: string
  type: NotificationType
  potId?: string | null
  participationId?: string | null
  title: string
  body: string
  actionPath?: string | null
  dedupeKey: string
}

// Drizzle executor interface (db or transaction instance)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = any

// 마이페이지 > 환경설정 > 알림 설정의 두 카테고리로 8개 알림 타입을 묶는다.
const FRIEND_NOTIFICATION_TYPES: NotificationType[] = ['FRIEND_REQUEST_RECEIVED', 'FRIEND_REQUEST_ACCEPTED']

/** insert 하기 전에 수신자의 환경설정을 확인한다 — 행이 없으면 기본 켜짐으로 간주. */
async function isNotificationEnabled(dbOrTx: DbOrTx, recipientId: string, type: NotificationType): Promise<boolean> {
  const [row] = await dbOrTx
    .select({
      potNotificationsEnabled: userPreferences.potNotificationsEnabled,
      friendNotificationsEnabled: userPreferences.friendNotificationsEnabled,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, recipientId))
    .limit(1)

  if (!row) return true

  return FRIEND_NOTIFICATION_TYPES.includes(type) ? row.friendNotificationsEnabled : row.potNotificationsEnabled
}

export async function createNotification(dbOrTx: DbOrTx, input: CreateNotificationInput) {
  try {
    if (!(await isNotificationEnabled(dbOrTx, input.recipientId, input.type))) return

    await dbOrTx
      .insert(notifications)
      .values({
        recipientId: input.recipientId,
        type: input.type,
        potId: input.potId ?? null,
        participationId: input.participationId ?? null,
        title: input.title,
        body: input.body,
        actionPath: input.actionPath ?? null,
        dedupeKey: input.dedupeKey,
      })
      .onConflictDoNothing({ target: notifications.dedupeKey })
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
}

export async function createNotificationBulk(dbOrTx: DbOrTx, inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return

  for (const input of inputs) {
    await createNotification(dbOrTx, input)
  }
}
