import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), 'data', 'family-finances.db')

// Ensure data directory exists
const dir = path.dirname(DB_PATH)
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

// Singleton pattern - reuse connection across hot reloads in dev
const globalForDb = global as unknown as { _db: ReturnType<typeof Database> }

const sqlite = globalForDb._db ?? new Database(DB_PATH)

if (process.env.NODE_ENV !== 'production') {
  globalForDb._db = sqlite
}

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { sqlite }
