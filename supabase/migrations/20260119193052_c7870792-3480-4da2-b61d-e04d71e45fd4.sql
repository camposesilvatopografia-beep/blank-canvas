-- Create table for user field permissions
-- This allows admins to configure which fields are visible and editable for each user/module combination
CREATE TABLE public.user_field_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module TEXT NOT NULL, -- carga, lancamento, pedreira, pipas, cal
  field_name TEXT NOT NULL, -- campo específico como 'viagens', 'local', 'material', etc.
  visible BOOLEAN DEFAULT true,
  editable BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, module, field_name)
);

-- Enable RLS
ALTER TABLE public.user_field_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all field permissions"
ON public.user_field_permissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert field permissions"
ON public.user_field_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update field permissions"
ON public.user_field_permissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete field permissions"
ON public.user_field_permissions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own field permissions
CREATE POLICY "Users can view their own field permissions"
ON public.user_field_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Security definer function to get user field permissions for a specific module
CREATE OR REPLACE FUNCTION public.get_user_field_permissions(_user_id UUID, _module TEXT)
RETURNS TABLE(field_name TEXT, visible BOOLEAN, editable BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT field_name, visible, editable
  FROM public.user_field_permissions
  WHERE user_id = _user_id AND module = _module
$$;

-- Function to check if a specific field is visible for a user
CREATE OR REPLACE FUNCTION public.is_field_visible(_user_id UUID, _module TEXT, _field TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT visible FROM public.user_field_permissions 
     WHERE user_id = _user_id AND module = _module AND field_name = _field),
    true -- default to visible if no specific permission is set
  )
$$;

-- Function to check if a specific field is editable for a user
CREATE OR REPLACE FUNCTION public.is_field_editable(_user_id UUID, _module TEXT, _field TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT editable FROM public.user_field_permissions 
     WHERE user_id = _user_id AND module = _module AND field_name = _field),
    true -- default to editable if no specific permission is set
  )
$$;