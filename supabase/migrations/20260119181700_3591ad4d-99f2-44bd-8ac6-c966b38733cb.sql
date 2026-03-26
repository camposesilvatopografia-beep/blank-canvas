-- Drop the overly permissive SELECT policy for empresas
DROP POLICY IF EXISTS "Authenticated users can read empresas" ON public.empresas;

-- Create a new restrictive policy that only allows admins to read empresas
CREATE POLICY "Admins can read empresas" 
ON public.empresas 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));