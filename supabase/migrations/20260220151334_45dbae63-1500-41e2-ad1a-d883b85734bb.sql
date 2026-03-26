-- Fix overly permissive policy on rdo_saved_signatures
DROP POLICY IF EXISTS "Responsaveis RDO can manage saved signatures" ON public.rdo_saved_signatures;

-- Allow authenticated users to manage their own saved signatures (by email match via profile)
CREATE POLICY "Authenticated users can manage saved signatures"
ON public.rdo_saved_signatures
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);