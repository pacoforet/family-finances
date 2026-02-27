import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

// Singleton for dev hot reloads
const globalForDb = global as unknown as { _pgClient: ReturnType<typeof postgres> }

const client = globalForDb._pgClient ?? postgres(connectionString, { max: 1 })

if (process.env.NODE_ENV !== 'production') {
  globalForDb._pgClient = client
}

export const db = drizzle(client, { schema })
