ALTER TABLE public.locais ADD COLUMN IF NOT EXISTS latitude double precision DEFAULT NULL;
ALTER TABLE public.locais ADD COLUMN IF NOT EXISTS longitude double precision DEFAULT NULL;