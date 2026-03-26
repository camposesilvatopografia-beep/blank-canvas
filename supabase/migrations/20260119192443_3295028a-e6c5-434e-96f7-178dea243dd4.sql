-- Create table to store user-location permissions
CREATE TABLE public.user_location_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id UUID NOT NULL REFERENCES public.locais(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_id)
);

-- Enable RLS
ALTER TABLE public.user_location_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all location permissions
CREATE POLICY "Admins can view all location permissions"
ON public.user_location_permissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can manage all location permissions
CREATE POLICY "Admins can manage all location permissions"
ON public.user_location_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Users can view their own location permissions
CREATE POLICY "Users can view own location permissions"
ON public.user_location_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Function to check if user has permission for a specific local
CREATE OR REPLACE FUNCTION public.has_local_permission(_user_id uuid, _local_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.user_location_permissions WHERE user_id = _user_id AND local_id = _local_id),
    true -- Default to true if no specific permission is set (all locations allowed by default)
  )
$$;

-- Function to get all allowed local IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_allowed_locals(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id 
  FROM public.locais l
  WHERE l.status = 'Ativo'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_location_permissions ulp 
    WHERE ulp.user_id = _user_id 
    AND ulp.local_id = l.id 
    AND ulp.enabled = false
  )
$$;