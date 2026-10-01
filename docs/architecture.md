# Architecture

## Layout

```
app/
  (app)/                 signed-in pages, behind the setup gate in (app)/layout.tsx
    dashboard/  transactions/  budget/  categories/  reports/  import/
  api/                   route handlers (all server-side, all validated with Zod)
  login/  setup/         public sign-in page, first-run wizard
  layout.tsx             fonts, theme script, settings provider
  globals.css            design tokens (see docs/design.md)
components/
  kit/                   app-specific UI: PageHeader, MonthSwitcher, Money, Meter,
                         CategoryLine, PaceChart, MerchantAvatar, StatusPill, useInitialMonth
  layout/                sidebar, mobile drawer, theme toggle, nav hooks
  transactions/          add dialog, edit sheet, suggestions inbox
  ui/                    shadcn/ui primitives restyled with the tokens
db/
  schema.ts              Drizzle schema
  migrations/            committed SQL migrations (0000–0006)
lib/
  api.ts                 withApiErrors, parseJsonBody, parseSearchParams, HttpError
  validation.ts          Zod schemas for every route
  budget-calculator.ts   pure month summary (budget vs actual)
  budget-data.ts         loads the rows a month or a range needs
  categorizer.ts         categorization model (pure)
  auto-categorize.ts     model ↔ database
  llm-categorizer.ts     optional Claude suggestions
  category-mapper.ts     rule matcher
  csv-parser.ts          Revolut CSV parsing and dedup fingerprints
  format.ts              locale/currency/date formatting without timezone drift
  ui-copy.ts             English and Spanish UI strings
proxy.ts                 auth gate (Next 16's replacement for middleware)
```

## Pages

| Path | What it shows |
| --- | --- |
| `/dashboard` | Spent vs budget with a pace chart, income, margin, per-person spending, review callout, categories, recent activity |
| `/transactions` | Day-grouped ledger with filters, plus the **To review** tab (`?review=1`) |
| `/budget` | Monthly budget lines, copy previous month, apply to several months |
| `/categories` | Categories, rules, and a rule tester |
| `/reports` | Monthly breakdown and distribution, yearly bars against budget |
| `/import` | CSV upload with preview and a result summary |
| `/setup` | First-run wizard (redirects to `/dashboard` once completed) |

Without a `?month=YYYY-MM` parameter, dashboard, transactions and reports open on the current month. If the current month has no transactions yet, for example on the 1st, they open on the latest month that has data.

The old Spanish paths (`/transacciones`, `/presupuesto`…) permanently redirect to the English ones.

## API

All handlers are wrapped in `withApiErrors`, which maps errors to status codes:

| Error | Status |
| --- | --- |
| Validation failure | 400 |
| Foreign-key violation | 400 |
| Unique violation | 409 |
| `HttpError` | its own status |
| Anything else | 500 |

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/app-settings` | PUT | Save workspace settings (first-run setup) |
| `/api/categories`, `/api/categories/:id` | GET, POST, PATCH, DELETE | Categories |
| `/api/mapping-rules`, `/api/mapping-rules/:id` | GET, POST, PATCH, DELETE | Rules |
| `/api/mapping-rules/test` | POST | Which rule a description would match |
| `/api/budget` | GET, POST | Budget lines for a year; upsert a month |
| `/api/budget/:year/:month` | GET | Month summary (see below) |
| `/api/reports/year` | GET | Twelve monthly totals in one request |
| `/api/transactions` | GET, POST | Paged list with filters; manual entry |
| `/api/transactions/:id` | GET, PATCH, DELETE | Read, edit or delete one transaction |
| `/api/transactions/bulk-categorize` | POST | Categorize uncategorized rows with the same description |
| `/api/transactions/import` | POST | CSV import (5 MB max) |
| `/api/categorize/run` | GET, POST | Auto-categorize pending rows (optionally with Claude) |
| `/api/categorize/suggestions` | GET | Pending suggestions |
| `/api/categorize/suggestions/:id` | POST | Accept or dismiss one suggestion |

## Data model

| Table | Notes |
| --- | --- |
| `app_settings` | One row: app name, household, locale, currency, timezone, household size, setup flag |
| `categories` | Name, color, sort order, `is_income` |
| `budget_lines` | One amount per category and month (unique on category, year, month) |
| `mapping_rules` | Match type, value, priority, active flag |
| `import_batches` | One row per CSV upload with counts |
| `transactions` | Bank or manual movements: see below |

Column types:

- Money is `numeric(14,2)` and is read as a JS number.
- Bank dates are `timestamp` (wall-clock, no timezone). `budget_date` is a `date`.
- Bookkeeping times are `timestamptz`.

All dates are exchanged as strings, so no timezone shift happens between the server and the browser.

`transactions` fields worth knowing:

- `category_source`: `manual`, `auto_rule` or `learned`.
- `exclude_from_budget`: left out of every total. Used for internal transfers.
- `split_annual`: an annual expense counted as 1/12 in each of the 12 months starting at its month.
- `budget_date`: count the transaction in another month.
- `suggested_category_id`, `suggested_exclude`, `suggestion_confidence`, `suggestion_source`, `suggestion_reason`: the pending suggestion, if any. See [categorization.md](categorization.md).

## Budget rules

`computeMonthSummary` in `lib/budget-calculator.ts` is pure and unit-tested:

- A transaction counts in its **effective month**: `budget_date` if set, otherwise its own date.
- Only completed transactions count (`COMPLETADO`/`COMPLETED`). Excluded ones never count.
- **Spending** is net per category: a refund (a positive amount in an expense category) reduces that category's spending instead of counting as income.
- **Income** is income-category transactions plus uncategorized credits in that month.
- **Status per line**: `warning` above 85 % of the budget, `over` above 100 %.
- `cumulativeByDay` holds spending accumulated per day. It feeds the dashboard pace chart, and its last value equals the month total. Annual items spread from earlier months count from day 1.

`lib/budget-data.ts` loads everything a range of months needs in four queries, including the previous 11 months for annual splits. The yearly report is therefore one request, not twelve.

## Import pipeline

1. `parseRevolutCSV` maps Spanish or English headers, states and amount formats. It skips reverted rows (`REVERTED`, `REVERTIDO`, `DEVUELTO`) and reports invalid rows.
2. Each row gets a SHA-256 fingerprint of date, description, amount, type and running balance. Rows already stored, under the current or the legacy fingerprint, or matching an existing movement by time, amount and balance, are counted as duplicates.
3. New rows are categorized (rules → learned model; see [categorization.md](categorization.md)).
4. Rows are inserted in one database transaction with `ON CONFLICT DO NOTHING` on the fingerprint, so concurrent imports cannot duplicate rows.
5. The response reports imported, duplicate, error, auto-categorized and suggested counts.

## Security model

- **Database access.** Only server code touches the database, through `DATABASE_URL`. Migrations `0001`, `0004` and `0005` enable RLS and revoke table access from Supabase's `anon` and `authenticated` roles, so the public Data API exposes nothing.
- **Authentication.** `proxy.ts` requires a Supabase session for every page and API route except `/login`.
  - API calls without a session get 401 JSON.
  - In production, missing Supabase variables give HTTP 503 instead of an open app.
- **Setup gate.** It is enforced server-side in `app/(app)/layout.tsx`.
- **Sign-ups.** Public sign-ups should be disabled in Supabase: every signed-in user has full access to the household.
- **Claude key.** `ANTHROPIC_API_KEY` is read only on the server.

## Migrations

| File | Change |
| --- | --- |
| `0000` | Initial schema |
| `0001` | Enable RLS on public tables |
| `0002` | `app_settings` |
| `0003` | Money as `numeric(14,2)`; unique budget line per category and month |
| `0004` | Lock down the Supabase Data API |
| `0005` | Real date types; indexes on date, category and effective date |
| `0006` | Categorization suggestion columns |

Run `npm run db:migrate` before deploying code that depends on a new migration.

## Testing

`npm test` runs the Vitest suites in `lib/*.test.ts`. They cover:

- the budget calculator (refunds, annual splits, effective month, cumulative series);
- the CSV parser and dedup fingerprints;
- the rule matcher and the categorizer;
- formatting and validation.

CI runs lint, typecheck, tests and a production build.
