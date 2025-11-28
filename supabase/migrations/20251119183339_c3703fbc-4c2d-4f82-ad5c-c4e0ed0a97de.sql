-- Drop the policy that won't work for NULL organization_id
DROP POLICY IF EXISTS "Admins can update org members" ON public.users;

-- Allow admins and owners to update users joining their org or already in their org
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
      AND (
        users.organization_id = u.organization_id  -- Already in org
        OR users.organization_id IS NULL  -- Joining org
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND public.is_admin_or_owner(u.id, u.organization_id)
      AND users.organization_id = u.organization_id  -- After update, must be in admin's org
  )
);