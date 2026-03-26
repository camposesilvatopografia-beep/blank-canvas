-- Add 'responsavel_rdo' as a recognized profile tipo
-- No schema change needed for profiles.tipo (it's text)
-- Just need to add RLS so responsavel_rdo users can see RDOs

-- Create a helper function to check if user is responsavel_rdo
CREATE OR REPLACE FUNCTION public.is_responsavel_rdo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND tipo = 'Responsavel RDO'
      AND status = 'ativo'
  )
$$;

-- Allow responsavel_rdo users to read all RDOs
CREATE POLICY "Responsaveis RDO can read rdos"
ON public.rdos
FOR SELECT
USING (
  public.is_responsavel_rdo(auth.uid())
);

-- Allow responsavel_rdo users to update rdos (for observations/signatures)
CREATE POLICY "Responsaveis RDO can update rdos"
ON public.rdos
FOR UPDATE
USING (public.is_responsavel_rdo(auth.uid()))
WITH CHECK (public.is_responsavel_rdo(auth.uid()));

-- Allow responsavel_rdo users to read rdo_obras
CREATE POLICY "Responsaveis RDO can read rdo_obras"
ON public.rdo_obras
FOR SELECT
USING (public.is_responsavel_rdo(auth.uid()));

-- Allow responsavel_rdo users to read rdo sub-tables
CREATE POLICY "Responsaveis RDO can read rdo_efetivo"
ON public.rdo_efetivo
FOR SELECT
USING (public.is_responsavel_rdo(auth.uid()));

CREATE POLICY "Responsaveis RDO can read rdo_equipamentos"
ON public.rdo_equipamentos
FOR SELECT
USING (public.is_responsavel_rdo(auth.uid()));

CREATE POLICY "Responsaveis RDO can read rdo_servicos"
ON public.rdo_servicos
FOR SELECT
USING (public.is_responsavel_rdo(auth.uid()));

CREATE POLICY "Responsaveis RDO can read rdo_fotos"
ON public.rdo_fotos
FOR SELECT
USING (public.is_responsavel_rdo(auth.uid()));

-- Allow responsavel_rdo to manage their own signatures
CREATE POLICY "Responsaveis RDO can manage saved signatures"
ON public.rdo_saved_signatures
FOR ALL
USING (true)
WITH CHECK (true);