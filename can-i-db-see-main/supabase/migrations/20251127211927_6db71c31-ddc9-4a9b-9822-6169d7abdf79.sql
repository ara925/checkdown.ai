-- Drop the problematic RLS policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view team members in their teams" ON public.team_members;

-- Create a simpler RLS policy that doesn't cause recursion
-- Users can view team_members where:
-- 1. They are a member of the same team
-- 2. Or they belong to the same organization (via teams table)

-- First, create a security definer function to safely get user's team IDs
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_auth_user_id uuid)
RETURNS SETOF integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tm.team_id 
  FROM team_members tm
  INNER JOIN users u ON u.id = tm.user_id
  WHERE u.auth_user_id = _auth_user_id;
$$;

-- Create a security definer function to safely get user's organization team IDs
CREATE OR REPLACE FUNCTION public.get_org_team_ids(_auth_user_id uuid)
RETURNS SETOF integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.id 
  FROM teams t
  INNER JOIN users u ON u.organization_id = t.organization_id
  WHERE u.auth_user_id = _auth_user_id;
$$;

-- Create a policy using the safe function
CREATE POLICY "Users can view team_members in their teams or org"
ON public.team_members
FOR SELECT
USING (
  team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  OR team_id IN (SELECT public.get_org_team_ids(auth.uid()))
);

-- Allow users to view their own team_member record
CREATE POLICY "Users can view their own team_member record"
ON public.team_members
FOR SELECT
USING (
  user_id = (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
  )
);