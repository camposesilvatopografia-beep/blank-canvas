-- Change the default value of the id column in the material table
-- to gen_random_uuid() to allow multiple records per user.
ALTER TABLE public.material 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add a comment explaining the fix
COMMENT ON TABLE public.material IS 'Fixed id default from auth.uid() to gen_random_uuid() to allow multiple registrations.';
