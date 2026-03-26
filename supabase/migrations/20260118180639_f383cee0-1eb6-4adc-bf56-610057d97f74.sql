-- Drop existing restrictive policies and recreate as permissive

-- MATERIAIS
DROP POLICY IF EXISTS "Admins can manage materiais" ON public.materiais;
DROP POLICY IF EXISTS "Authenticated users can read materiais" ON public.materiais;

CREATE POLICY "Admins can manage materiais" 
ON public.materiais 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read materiais" 
ON public.materiais 
FOR SELECT 
TO authenticated
USING (true);

-- LOCAIS
DROP POLICY IF EXISTS "Admins can manage locais" ON public.locais;
DROP POLICY IF EXISTS "Authenticated users can read locais" ON public.locais;

CREATE POLICY "Admins can manage locais" 
ON public.locais 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read locais" 
ON public.locais 
FOR SELECT 
TO authenticated
USING (true);

-- FORNECEDORES_CAL
DROP POLICY IF EXISTS "Admins can manage fornecedores_cal" ON public.fornecedores_cal;
DROP POLICY IF EXISTS "Authenticated users can read fornecedores_cal" ON public.fornecedores_cal;

CREATE POLICY "Admins can manage fornecedores_cal" 
ON public.fornecedores_cal 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read fornecedores_cal" 
ON public.fornecedores_cal 
FOR SELECT 
TO authenticated
USING (true);

-- EMPRESAS
DROP POLICY IF EXISTS "Admins can manage empresas" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users can read empresas" ON public.empresas;

CREATE POLICY "Admins can manage empresas" 
ON public.empresas 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read empresas" 
ON public.empresas 
FOR SELECT 
TO authenticated
USING (true);