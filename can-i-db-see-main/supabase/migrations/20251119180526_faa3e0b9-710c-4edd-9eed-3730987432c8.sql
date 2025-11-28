-- Allow users to view profile info of people who sent join requests to their organization
CREATE POLICY "Users can view join request users"
ON public.users
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT ojr.user_id
    FROM organization_join_requests ojr
    WHERE ojr.organization_id = get_user_organization_id(auth.uid())
      AND ojr.status = 'pending'
  )
);