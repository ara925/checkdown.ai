CREATE OR REPLACE FUNCTION public.dm_room_includes_user(_room TEXT, _user_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE a INTEGER; b INTEGER; part TEXT;
BEGIN
  IF _room IS NULL THEN RETURN FALSE; END IF;
  IF LEFT(_room, 3) <> 'dm:' THEN RETURN FALSE; END IF;
  part := split_part(_room, ':', 2);
  a := split_part(part, '-', 1)::INTEGER;
  b := split_part(part, '-', 2)::INTEGER;
  RETURN _user_id = a OR _user_id = b;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_thread_accessible(_thread_id INTEGER, _user_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE room TEXT;
BEGIN
  SELECT matrix_room_id INTO room FROM public.threads WHERE id = _thread_id;
  RETURN public.dm_room_includes_user(room, _user_id);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_threads_matrix_room_id ON public.threads(matrix_room_id);

CREATE POLICY "Users can view DM threads they participate in"
ON public.threads FOR SELECT
USING (
  public.dm_thread_accessible(
    id,
    (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  )
);

CREATE POLICY "Users can create DM threads they participate in"
ON public.threads FOR INSERT
WITH CHECK (
  matrix_room_id LIKE 'dm:%' AND
  public.dm_room_includes_user(
    matrix_room_id,
    (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  )
);

CREATE POLICY "Users can view DM thread messages"
ON public.thread_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.threads th
    WHERE th.id = thread_messages.thread_id AND
      public.dm_thread_accessible(
        th.id,
        (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
      )
  )
);

CREATE POLICY "Users can create DM thread messages"
ON public.thread_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.threads th
    WHERE th.id = thread_messages.thread_id AND
      public.dm_thread_accessible(
        th.id,
        (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
      )
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_message_receipts;