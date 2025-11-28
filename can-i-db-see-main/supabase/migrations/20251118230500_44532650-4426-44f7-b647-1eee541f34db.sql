-- Add unique constraint on organization name
ALTER TABLE public.organizations ADD CONSTRAINT organizations_name_unique UNIQUE (name);

-- Create a function to set session variables for RLS
CREATE OR REPLACE FUNCTION public.set_session_variables(
  _user_id INTEGER,
  _organization_id INTEGER,
  _department_id INTEGER,
  _role VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.user_id', _user_id::TEXT, false);
  PERFORM set_config('app.organization_id', _organization_id::TEXT, false);
  PERFORM set_config('app.department_id', _department_id::TEXT, false);
  PERFORM set_config('app.role', _role, false);
END;
$$;

-- Create user_roles entries for existing users
INSERT INTO public.user_roles (user_id, organization_id, role)
SELECT 
  id, 
  organization_id, 
  CASE 
    WHEN role = 'owner' THEN 'owner'::app_role
    WHEN role = 'admin' THEN 'admin'::app_role
    ELSE 'member'::app_role
  END
FROM public.users
WHERE organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id, role) DO NOTHING;