-- Dates were stored as text. Give them real types so the database validates
-- and compares them as dates:
-- - bookkeeping timestamps (ISO strings with "Z") become timestamptz;
-- - bank dates ("YYYY-MM-DD HH:MM:SS", local wall-clock time) become timestamp;
-- - budget_date ("YYYY-MM-01 00:00:00") becomes date.
-- Plus indexes for the month filters, which select on the effective date.
ALTER TABLE "app_settings" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "import_batches" ALTER COLUMN "imported_at" SET DATA TYPE timestamp with time zone USING "imported_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mapping_rules" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "fecha_inicio" SET DATA TYPE timestamp USING "fecha_inicio"::timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "fecha_fin" SET DATA TYPE timestamp USING "fecha_fin"::timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "budget_date" SET DATA TYPE date USING "budget_date"::date;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at"::timestamp with time zone;--> statement-breakpoint
CREATE INDEX "transactions_fecha_inicio_idx" ON "transactions" USING btree ("fecha_inicio");--> statement-breakpoint
CREATE INDEX "transactions_category_id_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transactions_effective_date_idx" ON "transactions" USING btree (COALESCE("budget_date", "fecha_inicio"));