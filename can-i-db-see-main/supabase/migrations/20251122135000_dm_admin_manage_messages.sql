DROP POLICY IF EXISTS "Admins can manage DM thread messages" ON public.thread_messages;
CREATE POLICY "Admins can manage DM thread messages"
ON public.thread_messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, (SELECT organization_id FROM public.users WHERE id = thread_messages.user_id))
  )
  AND EXISTS (
    SELECT 1 FROM public.threads th
    WHERE th.id = thread_messages.thread_id
      AND th.matrix_room_id LIKE 'dm:%'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, (SELECT organization_id FROM public.users WHERE id = thread_messages.user_id))
  )
);