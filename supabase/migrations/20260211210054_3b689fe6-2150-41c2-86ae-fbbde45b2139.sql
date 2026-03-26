
-- Table to store submenu-level permissions for each user
CREATE TABLE public.user_submenu_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  submenu_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, submenu_key)
);

-- Enable RLS
ALTER TABLE public.user_submenu_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own submenu permissions"
ON public.user_submenu_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all submenu permissions"
ON public.user_submenu_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_submenu_permissions_updated_at
BEFORE UPDATE ON public.user_submenu_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function
CREATE OR REPLACE FUNCTION public.has_submenu_permission(_user_id uuid, _submenu_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.user_submenu_permissions WHERE user_id = _user_id AND submenu_key = _submenu_key),
    true -- Default to true if no specific permission is set
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_submenu_permissions(_user_id uuid)
RETURNS TABLE(submenu_key text, enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT submenu_key, enabled FROM public.user_submenu_permissions WHERE user_id = _user_id
$$;
