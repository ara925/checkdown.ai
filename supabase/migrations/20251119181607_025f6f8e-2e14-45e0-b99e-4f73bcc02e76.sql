-- Drop the policy that still causes recursion
DROP POLICY IF EXISTS "Users can view join request users" ON public.users;

-- Create a security definer function to safely check if a user has a pending join request for an org
CREATE OR REPLACE FUNCTION public.user_has_pending_request_for_org(_requesting_user_id integer, _viewer_auth_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_join_requests ojr
    WHERE ojr.user_id = _requesting_user_id
      AND ojr.status = 'pending'
      AND ojr.organization_id = (
        SELECT organization_id 
        FROM public.users 
        WHERE auth_user_id = _viewer_auth_id
        LIMIT 1
      )
  )
$$;

-- Create the policy using the security definer function
CREATE POLICY "Users can view join request users"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.user_has_pending_request_for_org(id, auth.uid())
);