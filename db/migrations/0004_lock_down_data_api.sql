-- The app only reaches the database server-side through DATABASE_URL (Drizzle).
-- Supabase's Data API (PostgREST) is never used, yet the anon key is public and
-- anyone who signs up gets the `authenticated` role. Policies granting that role
-- full access therefore exposed every row through the REST API.
--
-- Lock the tables down completely for the API roles: RLS on every table, no
-- permissive policies, and no table privileges for anon/authenticated.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Some databases got an equivalent permissive policy on app_settings out of band.
DROP POLICY IF EXISTS app_settings_authenticated_all ON public.app_settings;--> statement-breakpoint
DROP POLICY IF EXISTS categories_authenticated_all ON public.categories;--> statement-breakpoint
DROP POLICY IF EXISTS budget_lines_authenticated_all ON public.budget_lines;--> statement-breakpoint
DROP POLICY IF EXISTS mapping_rules_authenticated_all ON public.mapping_rules;--> statement-breakpoint
DROP POLICY IF EXISTS import_batches_authenticated_all ON public.import_batches;--> statement-breakpoint
DROP POLICY IF EXISTS transactions_authenticated_all ON public.transactions;--> statement-breakpoint
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL ON public.app_settings, public.categories, public.budget_lines, public.mapping_rules, public.import_batches, public.transactions FROM %I',
        api_role
      );
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
