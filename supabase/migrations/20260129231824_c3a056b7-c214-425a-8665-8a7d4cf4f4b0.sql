-- Create table for equipment permissions (escavadeiras)
CREATE TABLE IF NOT EXISTS public.user_equipment_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  equipment_prefixo TEXT NOT NULL,
  equipment_type TEXT NOT NULL DEFAULT 'escavadeira', -- 'escavadeira' or 'caminhao'
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, equipment_prefixo, equipment_type)
);

-- Enable RLS
ALTER TABLE public.user_equipment_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own equipment permissions"
  ON public.user_equipment_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all equipment permissions"
  ON public.user_equipment_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_user_equipment_permissions_updated_at
  BEFORE UPDATE ON public.user_equipment_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to check equipment permission
CREATE OR REPLACE FUNCTION public.has_equipment_permission(_user_id uuid, _prefixo text, _type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.user_equipment_permissions 
     WHERE user_id = _user_id AND equipment_prefixo = _prefixo AND equipment_type = _type),
    true -- Default to true if no specific permission is set
  )
$$;

-- Function to get user allowed equipment
CREATE OR REPLACE FUNCTION public.get_user_allowed_equipment(_user_id uuid, _type text)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Returns all equipment prefixes except those explicitly disabled
  -- Since we can't query Google Sheets, we just return the list of disabled ones
  SELECT equipment_prefixo
  FROM public.user_equipment_permissions
  WHERE user_id = _user_id 
    AND equipment_type = _type
    AND enabled = false
$$;