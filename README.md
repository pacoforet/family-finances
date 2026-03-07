# Budget Starter

Self-hostable household budget app built with Next.js, Drizzle, PostgreSQL, and Supabase Auth.

This repository is designed for one household per deployment. A fresh clone signs in, completes `/setup`, and chooses either a blank workspace or a generic starter template.

## Stack

- Next.js 16
- React 19
- Drizzle ORM
- PostgreSQL
- Supabase Auth
- Tailwind CSS 4

## What ships out of the box

- Email/password auth through Supabase
- First-run setup wizard for app name, household name, locale, currency, timezone, and household size
- Monthly budget planning
- Transaction import from Revolut CSV files
- Category rules for auto-categorization
- Reports and dashboard views

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Create a Supabase project and fill in:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Run migrations and seed:

```bash
npm run db:migrate
npm run db:seed
```

5. Create your first user in Supabase Auth.

Use the Supabase dashboard or your preferred admin flow to create an email/password user before first login.

6. Start the app:

```bash
npm run dev
```

7. Sign in at [http://localhost:3000/login](http://localhost:3000/login), then complete `/setup`.

## Deployment

### Vercel + Supabase

1. Create a Supabase project.
2. Import this repo into Vercel.
3. Add the three environment variables from `.env.example`.
4. Run the SQL migrations against your database.
5. Create the initial user in Supabase Auth.
6. Open the deployment URL, sign in, and complete setup.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Drizzle and the API routes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key for browser auth |

## Setup behavior

- `db:seed` is intentionally minimal.
- Household-specific categories, budgets, and starter rules are created during `/setup`.
- The starter template is optional. Choose `Start blank` if you want to configure everything yourself.

## Notes

- This starter currently assumes Revolut CSV imports. Other bank importers can be added as additional parsers.
- One deployment maps to one household database. Multi-household SaaS behavior is intentionally out of scope.
