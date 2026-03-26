-- Add usuario (username) column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usuario TEXT UNIQUE;

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_usuario ON public.profiles(usuario);