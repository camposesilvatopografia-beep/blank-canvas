-- Create table for quarry materials (materiais da pedreira)
CREATE TABLE public.materiais_pedreira (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.materiais_pedreira ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all materiais_pedreira"
ON public.materiais_pedreira
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert materiais_pedreira"
ON public.materiais_pedreira
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update materiais_pedreira"
ON public.materiais_pedreira
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete materiais_pedreira"
ON public.materiais_pedreira
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy for apontadores to read active materials (needed for forms)
CREATE POLICY "Apontadores can view active materiais_pedreira"
ON public.materiais_pedreira
FOR SELECT
USING (status = 'Ativo');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_materiais_pedreira_updated_at
BEFORE UPDATE ON public.materiais_pedreira
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();