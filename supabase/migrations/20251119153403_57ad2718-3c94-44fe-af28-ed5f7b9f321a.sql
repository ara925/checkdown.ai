-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view org members" ON public.users;

-- Create a security definer function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_auth_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.users
  WHERE auth_user_id = _auth_user_id
  LIMIT 1
$$;

-- Create a non-recursive policy using the function
CREATE POLICY "Users can view org members"
ON public.users
FOR SELECT
USING (
  auth_user_id = auth.uid()
  OR
  (organization_id IS NOT NULL 
   AND organization_id = public.get_user_organization_id(auth.uid()))
);