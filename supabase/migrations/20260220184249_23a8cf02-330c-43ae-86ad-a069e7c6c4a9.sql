
-- Remover policy permissiva de INSERT e deixar apenas service role (que bypassa RLS)
DROP POLICY IF EXISTS "Service role can insert email logs" ON public.rdo_email_logs;
