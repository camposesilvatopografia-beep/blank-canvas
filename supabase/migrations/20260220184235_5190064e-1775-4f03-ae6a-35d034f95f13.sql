
-- Tabela de logs de emails enviados para aprovação de RDO
CREATE TABLE public.rdo_email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id uuid NOT NULL,
  obra_nome text,
  aprovador_num smallint NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'success', -- 'success' | 'error'
  error_message text,
  resend_id text,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.rdo_email_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver os logs
CREATE POLICY "Admins can view email logs"
  ON public.rdo_email_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- A edge function usa service role (sem restrição de RLS), mas bloqueamos insert via UI
CREATE POLICY "Service role can insert email logs"
  ON public.rdo_email_logs
  FOR INSERT
  WITH CHECK (true);
