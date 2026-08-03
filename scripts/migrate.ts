import { neon } from '@neondatabase/serverless'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sql: any = neon(dbUrl)

  const migrations = [
    'migrations/006_join_approval.sql',
    'migrations/007_notifications.sql',
  ]

  for (const mPath of migrations) {
    const fullPath = path.resolve(process.cwd(), mPath)
    if (!fs.existsSync(fullPath)) {
      console.warn(`Migration file not found: ${fullPath}`)
      continue
    }

    console.log(`Executing migration: ${mPath}...`)
    const rawSql = fs.readFileSync(fullPath, 'utf8')

    const statements = rawSql
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const stmt of statements) {
      try {
        await sql.query(stmt)
      } catch (err: unknown) {
        const message = String((err as { message?: string })?.message ?? err)
        if (message.includes('already exists')) {
          console.log(`Skipping existing object in statement: ${stmt.substring(0, 40)}...`)
        } else {
          console.error(`Error executing statement: ${stmt.substring(0, 40)}...`, message)
        }
      }
    }
    console.log(`Finished processing: ${mPath}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
