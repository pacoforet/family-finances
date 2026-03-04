-- Enable RLS on all app tables flagged by Supabase Security Advisor.
-- This policy set is intentionally conservative for the current architecture:
-- - allow authenticated users
-- - allow service_role (server-side/admin flows)
-- - block anon
--
-- Note: this does NOT provide per-user isolation yet because rows are not scoped
-- with a user_id column. That should be a follow-up migration.

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- categories
DROP POLICY IF EXISTS categories_authenticated_all ON public.categories;
CREATE POLICY categories_authenticated_all
  ON public.categories
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- budget_lines
DROP POLICY IF EXISTS budget_lines_authenticated_all ON public.budget_lines;
CREATE POLICY budget_lines_authenticated_all
  ON public.budget_lines
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- mapping_rules
DROP POLICY IF EXISTS mapping_rules_authenticated_all ON public.mapping_rules;
CREATE POLICY mapping_rules_authenticated_all
  ON public.mapping_rules
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- import_batches
DROP POLICY IF EXISTS import_batches_authenticated_all ON public.import_batches;
CREATE POLICY import_batches_authenticated_all
  ON public.import_batches
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- transactions
DROP POLICY IF EXISTS transactions_authenticated_all ON public.transactions;
CREATE POLICY transactions_authenticated_all
  ON public.transactions
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);
