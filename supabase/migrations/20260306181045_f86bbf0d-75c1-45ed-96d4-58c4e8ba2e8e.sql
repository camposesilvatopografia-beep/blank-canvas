-- Add foto_path column to alm_movimentacoes
ALTER TABLE public.alm_movimentacoes ADD COLUMN IF NOT EXISTS foto_path text DEFAULT NULL;

-- Add foto_path column to alm_materiais for product reference photo
ALTER TABLE public.alm_materiais ADD COLUMN IF NOT EXISTS foto_path text DEFAULT NULL;

-- Create storage bucket for almoxarifado photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('alm-fotos', 'alm-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for alm-fotos bucket
CREATE POLICY "Authenticated can upload alm-fotos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'alm-fotos');

CREATE POLICY "Anyone can view alm-fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'alm-fotos');

CREATE POLICY "Admins can delete alm-fotos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'alm-fotos' AND EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
));