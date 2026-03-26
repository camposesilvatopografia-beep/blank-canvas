
-- Storage bucket for plant files
INSERT INTO storage.buckets (id, name, public) VALUES ('retigrafico-plantas', 'retigrafico-plantas', true)
ON CONFLICT (id) DO NOTHING;

-- Table: obras_retigrafico
CREATE TABLE public.obras_retigrafico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  extensao_total NUMERIC,
  estaca_inicial TEXT,
  estaca_final TEXT,
  planta_path TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: servicos_retigrafico
CREATE TABLE public.servicos_retigrafico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'm²',
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: trechos_retigrafico
CREATE TABLE public.trechos_retigrafico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras_retigrafico(id) ON DELETE CASCADE,
  estaca_inicial TEXT NOT NULL,
  estaca_final TEXT NOT NULL,
  area_total NUMERIC NOT NULL DEFAULT 0,
  extensao NUMERIC,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: execucoes_retigrafico
CREATE TABLE public.execucoes_retigrafico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  obra_id UUID NOT NULL REFERENCES public.obras_retigrafico(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos_retigrafico(id) ON DELETE CASCADE,
  trecho_id UUID NOT NULL REFERENCES public.trechos_retigrafico(id) ON DELETE CASCADE,
  quantidade_executada NUMERIC NOT NULL DEFAULT 0,
  area_executada NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(data, servico_id, trecho_id)
);

-- Table: overlay_areas (for plant overlay polygons)
CREATE TABLE public.retigrafico_overlay_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras_retigrafico(id) ON DELETE CASCADE,
  trecho_id UUID NOT NULL REFERENCES public.trechos_retigrafico(id) ON DELETE CASCADE,
  polygon_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.obras_retigrafico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos_retigrafico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trechos_retigrafico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execucoes_retigrafico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retigrafico_overlay_areas ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admins can manage, authenticated can read
CREATE POLICY "Admins can manage obras_retigrafico" ON public.obras_retigrafico FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read obras_retigrafico" ON public.obras_retigrafico FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage servicos_retigrafico" ON public.servicos_retigrafico FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read servicos_retigrafico" ON public.servicos_retigrafico FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage trechos_retigrafico" ON public.trechos_retigrafico FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read trechos_retigrafico" ON public.trechos_retigrafico FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage execucoes_retigrafico" ON public.execucoes_retigrafico FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read execucoes_retigrafico" ON public.execucoes_retigrafico FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage overlay_areas" ON public.retigrafico_overlay_areas FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read overlay_areas" ON public.retigrafico_overlay_areas FOR SELECT USING (auth.uid() IS NOT NULL);

-- Storage RLS for plant uploads
CREATE POLICY "Admins can upload plantas" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'retigrafico-plantas' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update plantas" ON storage.objects FOR UPDATE USING (bucket_id = 'retigrafico-plantas' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete plantas" ON storage.objects FOR DELETE USING (bucket_id = 'retigrafico-plantas' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read plantas" ON storage.objects FOR SELECT USING (bucket_id = 'retigrafico-plantas' AND auth.uid() IS NOT NULL);

-- Enable realtime for execucoes
ALTER PUBLICATION supabase_realtime ADD TABLE public.execucoes_retigrafico;
