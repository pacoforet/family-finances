-- Store money as exact decimals instead of float4 (`real`), which only keeps
-- ~7 significant digits. Values are rounded to cents during the conversion so
-- float artifacts such as 12.3400001525879 become 12.34. The cast goes through
-- float8 because real::numeric keeps only 6 significant digits.
ALTER TABLE "budget_lines" ALTER COLUMN "amount" SET DATA TYPE numeric(14, 2) USING round("amount"::float8::numeric, 2);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "importe" SET DATA TYPE numeric(14, 2) USING round("importe"::float8::numeric, 2);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "comision" SET DATA TYPE numeric(14, 2) USING round("comision"::float8::numeric, 2);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "saldo" SET DATA TYPE numeric(14, 2) USING round("saldo"::float8::numeric, 2);--> statement-breakpoint
-- Remove duplicate budget lines (same category/year/month) created by the old
-- select-then-insert upsert, keeping one row per key, before enforcing uniqueness.
DELETE FROM "budget_lines" a
  USING "budget_lines" b
  WHERE a."category_id" = b."category_id"
    AND a."year" = b."year"
    AND a."month" = b."month"
    AND a."id" > b."id";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budget_lines_category_year_month_unique" ON "budget_lines" USING btree ("category_id","year","month");
