-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view join request users" ON public.users;

-- Create a better policy that doesn't cause recursion
-- This allows viewing users who have pending join requests, but uses a direct join instead of a function call
CREATE POLICY "Users can view join request users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_join_requests ojr
    INNER JOIN users org_user ON org_user.auth_user_id = auth.uid()
    WHERE ojr.user_id = users.id
      AND ojr.organization_id = org_user.organization_id
      AND ojr.status = 'pending'
  )
);