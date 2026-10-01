ALTER TABLE "transactions" ADD COLUMN "suggested_category_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggested_exclude" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggestion_confidence" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggestion_source" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggestion_reason" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_suggested_category_id_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;