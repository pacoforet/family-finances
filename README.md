# Family Finances

Family Finances is a self-hostable household budget app built with Next.js, Drizzle, PostgreSQL, and Supabase Auth.

It is designed as a reusable starter, not a hosted SaaS. One deployment maps to one household database. A fresh clone signs in, completes `/setup`, and chooses either a blank workspace or a generic starter template.

## Features

- First-run setup wizard for app name, household name, locale, currency, timezone, and household size
- Locale-aware UI and formatting for English and Spanish
- Monthly budgeting with per-category budget lines
- Dashboard with budget-vs-actual summaries and recent activity
- Reports for monthly and yearly spending trends
- Manual transaction entry and transaction editing
- Rule-based auto-categorization for future imports
- CSV transaction import with a parser optimized for Revolut-style exports
- Single-household deployment model that is straightforward to self-host

## Stack

- Next.js 16
- React 19
- TypeScript
- Drizzle ORM
- PostgreSQL
- Supabase Auth
- Tailwind CSS 4

## Product Model

- One deployment = one household
- Authentication is handled with Supabase Auth
- App configuration is stored in `app_settings`
- `db:seed` stays minimal on purpose
- Starter categories, starter rules, and optional starter budgets are created during `/setup`

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Copy the example environment file.

```bash
cp .env.example .env.local
```

3. Create a Supabase project at [supabase.com](https://supabase.com) and fill in `.env.local`:

- `DATABASE_URL` — found in **Project Settings → Database → Connection string → URI** (use the pooler URI for Vercel deployments)
- `NEXT_PUBLIC_SUPABASE_URL` — found in **Project Settings → API → Project URL**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — found in **Project Settings → API → anon / public key**

4. Run database migrations and seed.

```bash
npm run db:setup
```

This runs `db:generate`, `db:migrate`, and `db:seed` in sequence. You can also run each step individually if needed.

5. Create your first user in Supabase Auth.

Go to **Authentication → Users → Add user** in the Supabase dashboard, choose *Create new user*, and enter an email and password. This is the account you will use to sign in.

6. Start the app locally.

```bash
npm run dev
```

7. Open [http://localhost:3000/login](http://localhost:3000/login), sign in with the user you just created, and complete `/setup`.

## First-Run Setup

The first authenticated user is redirected to `/setup` until the workspace is configured. The setup flow lets you:

- choose the visible app name
- choose the household name
- pick locale, currency, timezone, and household size
- start blank or use a generic starter template
- optionally create starter monthly budgets for the current month

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Drizzle and the API routes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key for browser auth |

## Local Development Workflow

Common commands:

```bash
npm run dev
npm run lint
npm run build
npm run db:migrate
npm run db:seed
```

## Deploying on Vercel

### Recommended setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Import this repo into Vercel and add the three environment variables from `.env.example` in the Vercel project settings.
3. Run the migrations against your Supabase database. You can do this locally by pointing `DATABASE_URL` at your production database and running:

```bash
npm run db:setup
```

4. Go to **Authentication → Users → Add user** in the Supabase dashboard and create your first user.
5. Open the deployed app, sign in, and complete `/setup`.

### Notes

- This repo does not create a hosted multi-tenant product.
- Each deployment should use its own database.
- The public anonymous Supabase key is expected in the browser. Do not place service-role keys in this app.

## CSV Import Support

The current parser is optimized for Revolut-style CSV exports and some similar bank statements may work. Arbitrary bank CSV formats are not guaranteed yet. If you want broader import support, add additional parsers in `lib/csv-parser.ts`.

## Repository Hygiene

This repository is intended to stay safe to publish publicly:

- do not commit `.env.local` or any other real env files
- do not commit Supabase CLI temp state from `supabase/.temp`
- do not commit production exports, CSV statements, or database dumps
- do not add service-role credentials or private API tokens to client code

## Extending the Starter

Typical next steps if you want to build beyond the starter:

- add more bank-specific CSV parsers
- add recurring transaction support
- add richer reporting and charts
- add household member permissions
- add attachments or receipt storage
