import { getDb } from '../lib/db'
import { pots } from '../lib/db/schema'

async function main() {
  const db = getDb()
  const rows = await db.select({ id: pots.id, storeName: pots.storeName, status: pots.status, deadlineAt: pots.deadlineAt }).from(pots)
  console.log('POTS:', JSON.stringify(rows, null, 2))
}

main().then(() => process.exit(0))
