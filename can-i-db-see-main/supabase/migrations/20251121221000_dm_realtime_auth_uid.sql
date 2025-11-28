DROP POLICY IF EXISTS "Users can view DM threads they participate in" ON public.threads;
DROP POLICY IF EXISTS "Users can create DM threads they participate in" ON public.threads;
DROP POLICY IF EXISTS "Users can view DM thread messages" ON public.thread_messages;
DROP POLICY IF EXISTS "Users can create DM thread messages" ON public.thread_messages;

CREATE POLICY "Users can view DM threads they participate in"
ON public.threads FOR SELECT
USING (
  matrix_room_id LIKE 'dm:%' AND
  public.dm_room_includes_user(
    matrix_room_id,
    (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  )
);

CREATE POLICY "Users can create DM threads they participate in"
ON public.threads FOR INSERT
WITH CHECK (
  matrix_room_id LIKE 'dm:%' AND
  public.dm_room_includes_user(
    matrix_room_id,
    (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  )
);

CREATE POLICY "Users can view DM thread messages"
ON public.thread_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.threads th
    WHERE th.id = thread_messages.thread_id AND
      public.dm_room_includes_user(
        th.matrix_room_id,
        (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      )
  )
);

CREATE POLICY "Users can create DM thread messages"
ON public.thread_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.threads th
    WHERE th.id = thread_messages.thread_id AND
      public.dm_room_includes_user(
        th.matrix_room_id,
        (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      )
  )
);