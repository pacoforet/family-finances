CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "app_name" text NOT NULL,
  "household_name" text NOT NULL,
  "default_currency" text DEFAULT 'USD' NOT NULL,
  "locale" text DEFAULT 'en-US' NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "household_size" integer DEFAULT 1 NOT NULL,
  "setup_completed" boolean DEFAULT false NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
