
-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage alm_materiais" ON public.alm_materiais;
DROP POLICY IF EXISTS "Authenticated can read alm_materiais" ON public.alm_materiais;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage alm_materiais"
  ON public.alm_materiais
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read alm_materiais"
  ON public.alm_materiais
  FOR SELECT
  TO authenticated
  USING (true);
