
-- Create storage bucket for RDO photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rdo-fotos',
  'rdo-fotos',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload RDO photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rdo-fotos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view RDO photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'rdo-fotos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete RDO photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'rdo-fotos' AND auth.uid() IS NOT NULL);

-- Table to store RDO photo paths
CREATE TABLE public.rdo_fotos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  legenda TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rdo_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read rdo_fotos" ON public.rdo_fotos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can manage rdo_fotos" ON public.rdo_fotos FOR ALL USING (auth.uid() IS NOT NULL);
