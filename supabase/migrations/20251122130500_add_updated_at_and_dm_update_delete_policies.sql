ALTER TABLE public.thread_messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows so they don't appear as edited
UPDATE public.thread_messages SET updated_at = created_at;

CREATE OR REPLACE FUNCTION public.set_thread_messages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_thread_messages_updated_at'
  ) THEN
    CREATE TRIGGER set_thread_messages_updated_at
    BEFORE UPDATE ON public.thread_messages
    FOR EACH ROW EXECUTE FUNCTION public.set_thread_messages_updated_at();
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can update their own DM thread messages" ON public.thread_messages;
CREATE POLICY "Users can update their own DM thread messages"
ON public.thread_messages FOR UPDATE
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.threads th
    WHERE th.id = thread_messages.thread_id
      AND th.matrix_room_id LIKE 'dm:%'
      AND public.dm_room_includes_user(
        th.matrix_room_id,
        (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      )
  )
)
WITH CHECK (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their own DM thread messages" ON public.thread_messages;
CREATE POLICY "Users can delete their own DM thread messages"
ON public.thread_messages FOR DELETE
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.threads th
    WHERE th.id = thread_messages.thread_id
      AND th.matrix_room_id LIKE 'dm:%'
      AND public.dm_room_includes_user(
        th.matrix_room_id,
        (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      )
  )
);