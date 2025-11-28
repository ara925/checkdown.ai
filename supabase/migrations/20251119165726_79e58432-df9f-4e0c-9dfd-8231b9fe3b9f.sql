-- Add token column to invitations table for invitation links
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

-- Drop the automatic user creation trigger since we'll handle invitations explicitly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();