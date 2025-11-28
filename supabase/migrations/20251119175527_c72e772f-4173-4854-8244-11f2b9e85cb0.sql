-- Update handle_new_user function to include password_hash
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Check if user record already exists
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE auth_user_id = NEW.id
  ) THEN
    -- Create user record with empty password_hash (password is managed by Supabase Auth)
    INSERT INTO public.users (auth_user_id, email, name, organization_id, department_id, role, password_hash)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NULL,
      NULL,
      'member',
      ''  -- Empty string since password is managed by Supabase Auth
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create user record for existing auth user
INSERT INTO public.users (auth_user_id, email, name, organization_id, department_id, role, password_hash)
VALUES (
  '22bae8a9-252c-4bf5-87a6-f700af54b1b2',
  'tlgmarketing003@gmail.com',
  'Aftercall',
  NULL,
  NULL,
  'member',
  ''
)
ON CONFLICT (auth_user_id) DO NOTHING;