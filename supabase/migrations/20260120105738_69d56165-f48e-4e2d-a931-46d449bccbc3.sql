-- Table to store type-based admin permissions (which sections each type can access)
CREATE TABLE public.admin_type_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT NOT NULL,
  section TEXT NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_type, section)
);

-- Enable RLS
ALTER TABLE public.admin_type_permissions ENABLE ROW LEVEL SECURITY;

-- Allow admins to read permissions
CREATE POLICY "Admins can read type permissions"
ON public.admin_type_permissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow only main admin types to modify
CREATE POLICY "Admins can insert type permissions"
ON public.admin_type_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update type permissions"
ON public.admin_type_permissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete type permissions"
ON public.admin_type_permissions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default permissions for new types

-- Gerencia: Full access
INSERT INTO public.admin_type_permissions (user_type, section, can_view, can_edit) VALUES
('Gerencia', 'dashboard', true, true),
('Gerencia', 'carga', true, true),
('Gerencia', 'lancamento', true, true),
('Gerencia', 'pedreira', true, true),
('Gerencia', 'pipas', true, true),
('Gerencia', 'cal', true, true),
('Gerencia', 'cadastros', true, true),
('Gerencia', 'frota', true, true),
('Gerencia', 'alertas', true, true);

-- Engenharia: Reports only (view but no edit on most)
INSERT INTO public.admin_type_permissions (user_type, section, can_view, can_edit) VALUES
('Engenharia', 'dashboard', true, false),
('Engenharia', 'carga', true, false),
('Engenharia', 'lancamento', true, false),
('Engenharia', 'pedreira', true, false),
('Engenharia', 'pipas', true, false),
('Engenharia', 'cal', true, false),
('Engenharia', 'cadastros', false, false),
('Engenharia', 'frota', true, false),
('Engenharia', 'alertas', true, false);

-- Almoxarifado: Only materials/stock related
INSERT INTO public.admin_type_permissions (user_type, section, can_view, can_edit) VALUES
('Almoxarifado', 'dashboard', true, false),
('Almoxarifado', 'carga', false, false),
('Almoxarifado', 'lancamento', false, false),
('Almoxarifado', 'pedreira', false, false),
('Almoxarifado', 'pipas', false, false),
('Almoxarifado', 'cal', true, true),
('Almoxarifado', 'cadastros', true, true),
('Almoxarifado', 'frota', false, false),
('Almoxarifado', 'alertas', false, false);

-- Administrador: Full access (for reference)
INSERT INTO public.admin_type_permissions (user_type, section, can_view, can_edit) VALUES
('Administrador', 'dashboard', true, true),
('Administrador', 'carga', true, true),
('Administrador', 'lancamento', true, true),
('Administrador', 'pedreira', true, true),
('Administrador', 'pipas', true, true),
('Administrador', 'cal', true, true),
('Administrador', 'cadastros', true, true),
('Administrador', 'frota', true, true),
('Administrador', 'alertas', true, true);

-- Sala Técnica: Full access (for reference)
INSERT INTO public.admin_type_permissions (user_type, section, can_view, can_edit) VALUES
('Sala Técnica', 'dashboard', true, true),
('Sala Técnica', 'carga', true, true),
('Sala Técnica', 'lancamento', true, true),
('Sala Técnica', 'pedreira', true, true),
('Sala Técnica', 'pipas', true, true),
('Sala Técnica', 'cal', true, true),
('Sala Técnica', 'cadastros', true, true),
('Sala Técnica', 'frota', true, true),
('Sala Técnica', 'alertas', true, true);