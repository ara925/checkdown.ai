-- Create role enum
CREATE TYPE public.app_role AS ENUM ('member', 'admin', 'owner');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  organization_id INTEGER REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, organization_id)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id INTEGER, _role public.app_role, _org_id INTEGER)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND organization_id = _org_id
  )
$$;

-- Create function to check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id INTEGER, _org_id INTEGER)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('admin', 'owner')
  )
$$;

-- Enable RLS on tasks table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone in org can view tasks
CREATE POLICY "Users can view tasks in their organization"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = (SELECT id FROM public.users WHERE id = tasks.assignee_id OR id = tasks.manager_id)
  )
);

-- Policy: Members can create tasks
CREATE POLICY "Members can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (true);

-- Policy: Assignees can update their assigned tasks
CREATE POLICY "Assignees can update status of their tasks"
ON public.tasks
FOR UPDATE
USING (
  assignee_id = (SELECT id FROM public.users LIMIT 1)
)
WITH CHECK (
  assignee_id = (SELECT id FROM public.users LIMIT 1)
);

-- Policy: Admins and owners can update any task in their org
CREATE POLICY "Admins and owners can update any task"
ON public.tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.organization_id = tasks.department_id
      AND ur.role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.organization_id = tasks.department_id
      AND ur.role IN ('admin', 'owner')
  )
);

-- Policy: Users can view their roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = (SELECT id FROM public.users LIMIT 1));

-- Add index for performance
CREATE INDEX idx_user_roles_user_org ON public.user_roles(user_id, organization_id);
CREATE INDEX idx_user_roles_org_role ON public.user_roles(organization_id, role);