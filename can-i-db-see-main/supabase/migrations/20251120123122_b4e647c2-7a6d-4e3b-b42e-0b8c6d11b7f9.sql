CREATE TABLE IF NOT EXISTS public.thread_message_receipts (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

ALTER TABLE public.thread_message_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipts for accessible messages"
ON public.thread_message_receipts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.thread_messages tm
    WHERE tm.id = thread_message_receipts.message_id
  )
);

CREATE POLICY "Users can add receipts for accessible messages"
ON public.thread_message_receipts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.thread_messages tm
    WHERE tm.id = thread_message_receipts.message_id
  )
  AND user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can update their own receipts"
ON public.thread_message_receipts FOR UPDATE
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_tmrct_message_id ON public.thread_message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_tmrct_user_id ON public.thread_message_receipts(user_id);