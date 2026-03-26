-- Add policy to allow anyone to lookup email by username for login purposes
CREATE POLICY "Anyone can lookup profile by username for login"
ON public.profiles
FOR SELECT
USING (true);

-- Drop the restrictive view-only policy that requires authentication
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;