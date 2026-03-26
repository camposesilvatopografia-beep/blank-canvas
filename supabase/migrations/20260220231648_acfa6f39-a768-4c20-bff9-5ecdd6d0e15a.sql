
-- Table to store pre-registered emails that are allowed to access the system
CREATE TABLE public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nome text,
  tipo text NOT NULL DEFAULT 'Apontador',
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can manage allowed emails
CREATE POLICY "Admins can manage allowed_emails"
ON public.allowed_emails
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anon/authenticated can check if their email exists (for login validation)
CREATE POLICY "Anyone can check email existence"
ON public.allowed_emails
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_allowed_emails_updated_at
BEFORE UPDATE ON public.allowed_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with the main admin email
INSERT INTO public.allowed_emails (email, nome, tipo) 
VALUES ('jeanallbuquerque@gmail.com', 'Jean Albuquerque', 'Administrador');
