-- Fix users RLS policy to allow viewing users in same organization
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;

-- Allow users to view other users in their organization
CREATE POLICY "Users can view users in their organization"
ON public.users
FOR SELECT
USING (
  organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER
  OR id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
);

-- Keep the update policy for users to update their own record
-- (this should already exist, just making sure)
DROP POLICY IF EXISTS "Users can update their own record" ON public.users;

CREATE POLICY "Users can update their own record"
ON public.users
FOR UPDATE
USING (id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER);