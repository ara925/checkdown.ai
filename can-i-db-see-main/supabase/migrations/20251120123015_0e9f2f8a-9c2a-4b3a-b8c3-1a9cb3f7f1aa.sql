CREATE TABLE IF NOT EXISTS public.thread_message_reactions (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.thread_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions for accessible messages"
ON public.thread_message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.thread_messages tm
    WHERE tm.id = thread_message_reactions.message_id
  )
);

CREATE POLICY "Users can add reactions for accessible messages"
ON public.thread_message_reactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.thread_messages tm
    WHERE tm.id = thread_message_reactions.message_id
  )
  AND user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can remove their own reactions"
ON public.thread_message_reactions FOR DELETE
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_tmr_message_id ON public.thread_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_tmr_user_id ON public.thread_message_reactions(user_id);