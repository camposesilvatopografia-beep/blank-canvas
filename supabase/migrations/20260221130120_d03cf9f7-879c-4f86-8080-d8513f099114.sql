
CREATE TABLE public.obra_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  local TEXT NOT NULL DEFAULT '',
  logo_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.obra_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view obra_config"
ON public.obra_config FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert obra_config"
ON public.obra_config FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update obra_config"
ON public.obra_config FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Create storage bucket for obra logo
INSERT INTO storage.buckets (id, name, public) VALUES ('obra-logos', 'obra-logos', true);

CREATE POLICY "Anyone can view obra logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'obra-logos');

CREATE POLICY "Authenticated users can upload obra logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'obra-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update obra logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'obra-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete obra logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'obra-logos' AND auth.uid() IS NOT NULL);
