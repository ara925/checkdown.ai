CREATE TABLE IF NOT EXISTS public.thread_message_edits (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_text TEXT NOT NULL,
  new_text TEXT NOT NULL
);

ALTER TABLE public.thread_message_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view message edits" ON public.thread_message_edits;

CREATE POLICY "Participants can view message edits"
ON public.thread_message_edits FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.thread_messages tm
    JOIN public.threads th ON th.id = tm.thread_id
    WHERE tm.id = thread_message_edits.message_id
      AND th.matrix_room_id LIKE 'dm:%'
      AND public.dm_room_includes_user(
        th.matrix_room_id,
        (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Authors can insert message edits" ON public.thread_message_edits;
CREATE POLICY "Authors can insert message edits"
ON public.thread_message_edits FOR INSERT
WITH CHECK (
  editor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.audit_thread_message_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE editor INTEGER;
BEGIN
  IF NEW.text IS DISTINCT FROM OLD.text THEN
    SELECT id INTO editor FROM public.users WHERE auth_user_id = auth.uid();
    IF editor IS NULL THEN
      editor := OLD.user_id;
    END IF;
    INSERT INTO public.thread_message_edits(message_id, editor_id, old_text, new_text, edited_at)
    VALUES (OLD.id, editor, OLD.text, NEW.text, now());
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_thread_message_edit'
  ) THEN
    CREATE TRIGGER audit_thread_message_edit
    BEFORE UPDATE ON public.thread_messages
    FOR EACH ROW EXECUTE FUNCTION public.audit_thread_message_edit();
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can update their own DM thread messages" ON public.thread_messages;
CREATE POLICY "Users can update their own DM thread messages"
ON public.thread_messages FOR UPDATE
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  AND now() - created_at <= interval '120 seconds'
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
  AND now() - created_at <= interval '120 seconds'
);

DROP POLICY IF EXISTS "Admins can manage DM thread messages" ON public.thread_messages;
DROP POLICY IF EXISTS "Admins can view DM thread messages" ON public.thread_messages;
CREATE POLICY "Admins can view DM thread messages"
ON public.thread_messages FOR SELECT
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
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = 'public.thread_message_edits'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_message_edits;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tme_message_id ON public.thread_message_edits(message_id);
CREATE INDEX IF NOT EXISTS idx_tme_editor_id ON public.thread_message_edits(editor_id);
