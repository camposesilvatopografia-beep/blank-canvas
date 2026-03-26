
CREATE TABLE public.fornecedores_pedreira (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo'::text
);

ALTER TABLE public.fornecedores_pedreira ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fornecedores_pedreira" ON public.fornecedores_pedreira FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read fornecedores_pedreira" ON public.fornecedores_pedreira FOR SELECT USING (true);

CREATE TRIGGER update_fornecedores_pedreira_updated_at BEFORE UPDATE ON public.fornecedores_pedreira FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial data
INSERT INTO public.fornecedores_pedreira (nome) VALUES ('Brita Potiguar'), ('Herval');
