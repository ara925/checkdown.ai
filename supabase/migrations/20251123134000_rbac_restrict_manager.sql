DROP POLICY IF EXISTS "Managers manage roles except owner" ON public.user_roles;
DROP POLICY IF EXISTS "Managers can update users except owners" ON public.users;
DROP POLICY IF EXISTS "Managers can delete users except owners" ON public.users;