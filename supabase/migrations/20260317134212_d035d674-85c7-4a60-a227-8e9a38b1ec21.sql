
-- Table for purchase orders per fornecedor/material in Pedreira
CREATE TABLE public.pedidos_compra_pedreira (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT NOT NULL,
  material TEXT NOT NULL,
  quantidade_pedido NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  pdf_path TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint per fornecedor+material
ALTER TABLE public.pedidos_compra_pedreira ADD CONSTRAINT pedidos_compra_pedreira_unique UNIQUE (fornecedor, material);

-- Enable RLS
ALTER TABLE public.pedidos_compra_pedreira ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage pedidos_compra_pedreira"
  ON public.pedidos_compra_pedreira FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated can read
CREATE POLICY "Authenticated can read pedidos_compra_pedreira"
  ON public.pedidos_compra_pedreira FOR SELECT TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_pedidos_compra_pedreira_updated_at
  BEFORE UPDATE ON public.pedidos_compra_pedreira
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
