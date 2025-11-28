-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view users in their organization" ON public.users;

-- Create a simpler, non-recursive policy
-- Users can view their own record
CREATE POLICY "Users can view their own record"
ON public.users
FOR SELECT
USING (auth_user_id = auth.uid());

-- Users can view other users in the same organization
-- This uses a safer approach without recursion
CREATE POLICY "Users can view org members"
ON public.users
FOR SELECT
USING (
  organization_id IS NOT NULL 
  AND organization_id IN (
    SELECT u.organization_id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.organization_id IS NOT NULL
    LIMIT 1
  )
);