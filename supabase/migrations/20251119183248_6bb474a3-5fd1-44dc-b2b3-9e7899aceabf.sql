-- Allow admins and owners to update user records in their organization
CREATE POLICY "Admins can update org members"
ON public.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND public.is_admin_or_owner(u.id, u.organization_id)
      AND users.organization_id = u.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND public.is_admin_or_owner(u.id, u.organization_id)
      AND users.organization_id = u.organization_id
  )
);