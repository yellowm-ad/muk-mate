import { notifications } from '@/lib/db/schema'
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

export async function createNotification(dbOrTx: DbOrTx, input: CreateNotificationInput) {
  try {
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
