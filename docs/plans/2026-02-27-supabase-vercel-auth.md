# Supabase + Vercel + Auth Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate family finances app from SQLite to Supabase (PostgreSQL), deploy to Vercel, and replace PIN auth with Supabase Auth.

**Architecture:** Replace `better-sqlite3` + local SQLite with Supabase PostgreSQL via `postgres` driver and Drizzle ORM. Auth handled by Supabase Auth with Next.js middleware protecting all routes. Deploy to Vercel with custom domain `budget.pacoforet.com`.

**Tech Stack:** Next.js 16, Drizzle ORM (pg-core), `postgres` driver, `@supabase/ssr`, Vercel, Supabase.

---

## Prerequisites (manual steps before running the plan)

1. Create a new project in https://supabase.com (or use existing org)
2. Go to **Settings → Database → Connection string → URI** — copy the `Transaction` pooler URI (port 6543)
3. Go to **Settings → API** — copy `Project URL` and `anon public` key
4. Create a `.env.local` file in the project root:

```
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

5. In Supabase dashboard: **Authentication → Users → Add user** — create your account (email + password)

---

## Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

**Step 1: Remove SQLite, add Postgres + Supabase**

```bash
npm uninstall better-sqlite3 @types/better-sqlite3
npm install postgres @supabase/supabase-js @supabase/ssr
```

**Step 2: Verify install**

```bash
npm ls postgres @supabase/supabase-js @supabase/ssr
```

Expected: all three listed without errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap better-sqlite3 for postgres + supabase"
```

---

## Task 2: Migrate schema to PostgreSQL

**Files:**
- Modify: `db/schema.ts`

**Step 1: Replace the entire schema file**

Key changes:
- Import from `drizzle-orm/pg-core` instead of `drizzle-orm/sqlite-core`
- `sqliteTable` → `pgTable`
- `integer('col', { mode: 'boolean' })` → `boolean('col')`
- `real('col')` → `real('col')` (same name, different import)

```typescript
import { pgTable, text, real, integer, boolean } from 'drizzle-orm/pg-core'

// ─── Categories ─────────────────────────────────────────────────────────────
export const categories = pgTable('categories', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull().unique(),
  color:     text('color').notNull(),
  icon:      text('icon'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isIncome:  boolean('is_income').default(false).notNull(),
  createdAt: text('created_at').notNull(),
})

// ─── Budget Lines ────────────────────────────────────────────────────────────
export const budgetLines = pgTable('budget_lines', {
  id:         text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  year:       integer('year').notNull(),
  month:      integer('month').notNull(),
  amount:     real('amount').notNull(),
  notes:      text('notes'),
})

// ─── Mapping Rules ───────────────────────────────────────────────────────────
export const mappingRules = pgTable('mapping_rules', {
  id:          text('id').primaryKey(),
  categoryId:  text('category_id').notNull().references(() => categories.id),
  matchType:   text('match_type').notNull(),
  matchValue:  text('match_value').notNull(),
  priority:    integer('priority').default(100).notNull(),
  isActive:    boolean('is_active').default(true).notNull(),
  notes:       text('notes'),
  createdAt:   text('created_at').notNull(),
})

// ─── Import Batches ──────────────────────────────────────────────────────────
export const importBatches = pgTable('import_batches', {
  id:            text('id').primaryKey(),
  fileName:      text('file_name').notNull(),
  importedAt:    text('imported_at').notNull(),
  rowsTotal:     integer('rows_total').notNull(),
  rowsImported:  integer('rows_imported').notNull(),
  rowsSkipped:   integer('rows_skipped').notNull(),
  rowsErrored:   integer('rows_errored').notNull(),
})

// ─── Transactions ────────────────────────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id:                text('id').primaryKey(),
  importBatchId:     text('import_batch_id').references(() => importBatches.id),
  dedupHash:         text('dedup_hash').unique(),

  tipo:              text('tipo'),
  producto:          text('producto'),
  fechaInicio:       text('fecha_inicio').notNull(),
  fechaFin:          text('fecha_fin'),
  descripcion:       text('descripcion').notNull(),
  importe:           real('importe').notNull(),
  comision:          real('comision').default(0),
  divisa:            text('divisa').default('EUR'),
  state:             text('state'),
  saldo:             real('saldo'),

  categoryId:        text('category_id').references(() => categories.id),
  categorySource:    text('category_source'),
  notes:             text('notes'),
  isManual:          boolean('is_manual').default(false).notNull(),
  excludeFromBudget: boolean('exclude_from_budget').default(false).notNull(),
  splitAnnual:       boolean('split_annual').default(false).notNull(),
  budgetDate:        text('budget_date'),
  createdAt:         text('created_at').notNull(),
  updatedAt:         text('updated_at').notNull(),
})

// ─── Type exports ────────────────────────────────────────────────────────────
export type Category     = typeof categories.$inferSelect
export type BudgetLine   = typeof budgetLines.$inferSelect
export type MappingRule  = typeof mappingRules.$inferSelect
export type ImportBatch  = typeof importBatches.$inferSelect
export type Transaction  = typeof transactions.$inferSelect

export type NewCategory    = typeof categories.$inferInsert
export type NewBudgetLine  = typeof budgetLines.$inferInsert
export type NewMappingRule = typeof mappingRules.$inferInsert
export type NewTransaction = typeof transactions.$inferInsert
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only errors in db/index.ts which we fix next).

**Step 3: Commit**

```bash
git add db/schema.ts
git commit -m "feat: migrate schema from sqlite-core to pg-core"
```

---

## Task 3: Update DB connection

**Files:**
- Modify: `db/index.ts`

**Step 1: Rewrite db/index.ts**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add db/index.ts
git commit -m "feat: switch db driver to postgres-js for supabase"
```

---

## Task 4: Update Drizzle config

**Files:**
- Modify: `drizzle.config.ts`

**Step 1: Replace drizzle.config.ts**

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

**Step 2: Clear old SQLite migrations**

```bash
rm -rf db/migrations
```

**Step 3: Generate new PostgreSQL migrations**

```bash
npx drizzle-kit generate
```

Expected: new migration files in `db/migrations/`.

**Step 4: Push schema to Supabase**

```bash
npx drizzle-kit migrate
```

Expected: tables created in Supabase. Verify in Supabase dashboard → Table Editor.

**Step 5: Commit**

```bash
git add drizzle.config.ts db/migrations
git commit -m "feat: update drizzle config to postgresql + generate migrations"
```

---

## Task 5: Migrate existing data from SQLite

**Files:**
- Create: `scripts/export-sqlite.ts` (temporary, delete after use)

**Step 1: Create export script**

```typescript
// scripts/export-sqlite.ts
import Database from 'better-sqlite3'  // may need to reinstall temporarily
import fs from 'fs'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'data', 'family-finances.db'))

const tables = ['categories', 'budget_lines', 'mapping_rules', 'import_batches', 'transactions']
const data: Record<string, unknown[]> = {}

for (const table of tables) {
  data[table] = sqlite.prepare(`SELECT * FROM ${table}`).all()
}

fs.writeFileSync('data/export.json', JSON.stringify(data, null, 2))
console.log('Exported:', Object.entries(data).map(([k, v]) => `${k}: ${v.length}`).join(', '))
```

> **Note:** If better-sqlite3 was already uninstalled, run `npm install better-sqlite3 @types/better-sqlite3 --save-dev` temporarily, run the export, then uninstall again.

**Step 2: Run the export**

```bash
npx tsx scripts/export-sqlite.ts
```

Expected: `data/export.json` created with your data.

**Step 3: Create import script**

```typescript
// scripts/import-supabase.ts
import postgres from 'postgres'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
const data = JSON.parse(fs.readFileSync('data/export.json', 'utf-8'))

async function importTable(tableName: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  // Convert SQLite integer booleans to actual booleans
  const booleanCols: Record<string, string[]> = {
    categories: ['is_income'],
    mapping_rules: ['is_active'],
    transactions: ['is_manual', 'exclude_from_budget', 'split_annual'],
  }
  const cols = booleanCols[tableName] ?? []
  const converted = rows.map(row => {
    const r = { ...row }
    for (const col of cols) {
      if (col in r) r[col] = Boolean(r[col])
    }
    return r
  })
  await sql`INSERT INTO ${sql(tableName)} ${sql(converted)} ON CONFLICT DO NOTHING`
  console.log(`Imported ${converted.length} rows into ${tableName}`)
}

async function main() {
  const order = ['categories', 'budget_lines', 'mapping_rules', 'import_batches', 'transactions']
  for (const table of order) {
    await importTable(table, data[table] ?? [])
  }
  await sql.end()
}

main().catch(console.error)
```

**Step 4: Run the import**

```bash
npx tsx scripts/import-supabase.ts
```

Expected: all rows imported. Verify in Supabase → Table Editor.

**Step 5: Verify data in the app**

```bash
npm run dev
```

Open http://localhost:3000/dashboard — data should appear.

**Step 6: Cleanup**

```bash
rm scripts/export-sqlite.ts scripts/import-supabase.ts data/export.json
git add -A
git commit -m "chore: remove temporary migration scripts"
```

---

## Task 6: Add Supabase Auth middleware

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `middleware.ts`
- Modify: `app/layout.tsx`

**Step 1: Create server-side Supabase client**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

**Step 2: Create browser-side Supabase client**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 3: Create middleware.ts (route protection)**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public routes
  if (pathname === '/login') {
    if (user) return NextResponse.redirect(new URL('/dashboard', request.url))
    return supabaseResponse
  }

  // Everything else requires auth
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/(?!.*)).*)'],
}
```

**Step 4: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add supabase auth middleware and client utilities"
```

---

## Task 7: Replace PIN login with Supabase Auth login page

**Files:**
- Modify: `app/unlock/page.tsx` → rename to `app/login/page.tsx`
- Delete: `app/unlock/page.tsx`, `app/api/unlock/route.ts`

**Step 1: Create new login page**

```bash
mkdir -p app/login
```

```typescript
// app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Finanzas Familiares</h1>
          <p className="text-muted-foreground text-sm mt-1">Introduce tus credenciales para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={!email || !password || loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Delete old auth files**

```bash
rm -rf app/unlock app/api/unlock
```

**Step 3: Add logout button to Sidebar**

In `components/layout/Sidebar.tsx`, add a logout button at the bottom:

```typescript
// Add import at top
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

// Inside the Sidebar component
const supabase = createClient()
const router = useRouter()

const handleLogout = async () => {
  await supabase.auth.signOut()
  router.push('/login')
  router.refresh()
}

// Add button at bottom of sidebar JSX:
// <button onClick={handleLogout} ...><LogOut /> Cerrar sesión</button>
```

**Step 4: Update login page layout — no sidebar**

The login page should not show the sidebar. Move the sidebar to a nested layout:

- Move `<Sidebar />` out of `app/layout.tsx` into a new `app/(app)/layout.tsx`
- Move all pages except `login` under `app/(app)/`

> **Simplification alternative:** Instead of route groups, conditionally hide the sidebar using middleware headers or a simple client check. The easiest approach: make the Sidebar a client component that checks `pathname` and hides itself on `/login`.

Simplest fix — in `app/layout.tsx`, check if we're on login:

```typescript
// This is a server component — use a wrapper approach:
// Wrap sidebar in a client component that checks pathname
```

Actually the simplest approach: create `app/login/layout.tsx`:

```typescript
// app/login/layout.tsx
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

And in `app/layout.tsx`, wrap sidebar in a conditional client component:

```typescript
// components/layout/ConditionalSidebar.tsx
'use client'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

export function ConditionalSidebar() {
  const pathname = usePathname()
  if (pathname === '/login') return null
  return <Sidebar />
}
```

Then in `app/layout.tsx`:
```typescript
import { ConditionalSidebar } from '@/components/layout/ConditionalSidebar'
// Replace <Sidebar /> with <ConditionalSidebar />
```

**Step 5: Verify login flow**

```bash
npm run dev
```

- Open http://localhost:3000 → should redirect to /login
- Login with your Supabase user → should reach /dashboard
- Check sidebar shows logout button

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: replace PIN auth with supabase email auth"
```

---

## Task 8: Deploy to Vercel

> All steps are manual in dashboards / CLI.

**Step 1: Push to GitHub**

```bash
git push origin main
```

**Step 2: Connect to Vercel**

1. Go to https://vercel.com → New Project
2. Import from GitHub → select `family-finances` repo
3. Framework: Next.js (auto-detected)
4. Add environment variables:
   - `DATABASE_URL` — Supabase Transaction pooler URI
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
5. Deploy

**Step 3: Verify deployment**

Open the Vercel preview URL → should show /login, login works, data appears.

**Step 4: Add custom domain**

1. In Vercel → Project → Settings → Domains → Add `budget.pacoforet.com`
2. In your DNS provider (where pacoforet.com is registered): add a `CNAME` record:
   - Name: `budget`
   - Value: `cname.vercel-dns.com`
3. Wait for DNS propagation (~5-30 min)
4. Verify: https://budget.pacoforet.com works

**Step 5: Update Supabase Auth allowed URLs**

In Supabase → Authentication → URL Configuration:
- **Site URL:** `https://budget.pacoforet.com`
- **Redirect URLs:** `https://budget.pacoforet.com/**`

---

## Task 9: Cleanup

**Step 1: Remove unused env vars and code**

```bash
# Remove APP_PIN references if any remain
grep -r "APP_PIN" app/ lib/
```

**Step 2: Update .env.local.example if it exists**

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: cleanup post-migration"
git push origin main
```

---

## Summary of changes

| What | From | To |
|---|---|---|
| DB driver | `better-sqlite3` | `postgres` |
| Drizzle adapter | `drizzle-orm/better-sqlite3` | `drizzle-orm/postgres-js` |
| Schema types | `sqliteTable`, `integer(boolean)` | `pgTable`, `boolean()` |
| Auth | PIN cookie | Supabase Auth + middleware |
| Hosting | local | Vercel |
| DB | local SQLite file | Supabase PostgreSQL |
