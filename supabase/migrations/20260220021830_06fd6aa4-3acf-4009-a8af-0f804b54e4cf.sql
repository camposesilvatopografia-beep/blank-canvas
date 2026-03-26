
-- Habilitar RLS na tabela rdo_saved_signatures
ALTER TABLE public.rdo_saved_signatures ENABLE ROW LEVEL SECURITY;

-- Apenas a service role (edge functions) pode acessar — sem políticas adicionais
-- Isso bloqueia acesso via PostgREST/anon, mas permite acesso via service_role key nas edge functions
