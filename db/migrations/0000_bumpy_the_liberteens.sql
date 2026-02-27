CREATE TABLE "budget_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount" real NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_income" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"imported_at" text NOT NULL,
	"rows_total" integer NOT NULL,
	"rows_imported" integer NOT NULL,
	"rows_skipped" integer NOT NULL,
	"rows_errored" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"match_type" text NOT NULL,
	"match_value" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"import_batch_id" text,
	"dedup_hash" text,
	"tipo" text,
	"producto" text,
	"fecha_inicio" text NOT NULL,
	"fecha_fin" text,
	"descripcion" text NOT NULL,
	"importe" real NOT NULL,
	"comision" real DEFAULT 0,
	"divisa" text DEFAULT 'EUR',
	"state" text,
	"saldo" real,
	"category_id" text,
	"category_source" text,
	"notes" text,
	"is_manual" boolean DEFAULT false NOT NULL,
	"exclude_from_budget" boolean DEFAULT false NOT NULL,
	"split_annual" boolean DEFAULT false NOT NULL,
	"budget_date" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "transactions_dedup_hash_unique" UNIQUE("dedup_hash")
);
--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;