# Changelog

## 2026-10-01: Redesign, smart categorization, mobile

### Interface
- **New look ("Libreta")**:
  - warm paper palette with pine, brass and terracotta tokens;
  - Fraunces + Instrument Sans;
  - a dark navigation spine with a badge for pending suggestions;
  - a separately designed dark mode that loads without a flash.
  
  See [docs/design.md](docs/design.md).
- **Dashboard**:
  - hero spending figure with a cumulative pace chart against the budget;
  - income, margin and per-person tiles;
  - review callout;
  - category meters with status labels;
  - recent activity with merchant avatars.
- **Transactions**: grouped by day with a daily net, an inline category picker, an **Auto** marker on automatically categorized rows, and a **To review** tab.
- **Yearly report**: draws each month's budget as a tick and turns over-budget months terracotta. Totals and the average ignore months still to come, and the average uses closed months only.
- **Import**: reports how many rows were auto-categorized and how many need review.
- **Restyled** login, setup, budget, categories and the transaction edit sheet.
- **Opening month**: dashboard, transactions and reports open on the latest month with data when the current month has none yet.

### Categorization
- **Learned model** (`lib/categorizer.ts`):
  - merchant normalization;
  - amount-weighted votes from the household's history;
  - trigram similarity for unseen variants;
  - calibrated confidence.
  
  Confident predictions are applied; medium ones become suggestions to review.
- **Review queue**: accept, recategorize, exclude or dismiss suggestions. Accepted answers train the model.
- **Optional Claude step** for merchants never seen before, enabled with `ANTHROPIC_API_KEY`. Its results are always stored as suggestions.
- **Rules** match whole words and ignore accents. `gene` no longer matches "Generalitat".
- **Migration `0006_categorization_suggestions`.**

Details: [docs/categorization.md](docs/categorization.md).

### Mobile
- **No more sideways scrolling.** Responsive grids now start from one column; before, a single long amount could widen a page past the screen.
- **No zoom on focus.** Form fields are 16 px on phones, so iOS Safari no longer zooms in.
- **Category rows** keep the name readable on phones by moving the status and budget under the meter.
- **Edit sheet** is full width and no longer pre-focuses "No category", which made it look selected.
- **Category actions** (edit, delete, income toggle) are visible on touch screens.

### Import
- **Reverted Spanish rows skipped.** Rows exported as `DEVUELTO` (reverted) are skipped.
- **Renamed merchants deduplicated.** Revolut sometimes renames a merchant between exports; those rows are now recognized as duplicates.

## 2026-09-29: Fixes, validation and data model

### Security
- **Data API locked down.** RLS enabled and table access revoked for Supabase's `anon` and `authenticated` roles (migration `0004`), so the public Data API exposes nothing.
- **Fail closed.** `proxy.ts` returns 503 in production without Supabase configuration and 401 JSON for unauthenticated API calls.
- **Setup gate moved server-side.**

### Correctness
- **Refunds** reduce their category's spending instead of counting as income.
- **Income** respects exclusions and transaction state.
- **Money** is `numeric(14,2)` instead of float (migration `0003`).
- **Real date types** (migration `0005`); dates no longer shift across timezones.
- **CSV import**:
  - English and Spanish Revolut headers and states;
  - thousands separators;
  - dedup fingerprint includes the running balance;
  - transactional insert with `ON CONFLICT DO NOTHING`.

### Structure
- **Validation.** Zod validation for every API route, with consistent 400/409 errors.
- **Yearly report in one request.** Served by `GET /api/reports/year` instead of twelve requests.
- **English routes.** Pages moved to English paths (`/transactions`, `/budget`…); the Spanish ones redirect.
- **Tests and CI.** Vitest suites and GitHub Actions CI (lint, typecheck, tests, build).
