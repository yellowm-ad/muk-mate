import { getDb } from '../lib/db'
import { pots } from '../lib/db/schema'

async function main() {
  const db = getDb()
  const rows = await db.select({ id: pots.id, storeName: pots.storeName, status: pots.status }).from(pots).limit(5)
  console.log('POTS_IN_DB:', JSON.stringify(rows, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
