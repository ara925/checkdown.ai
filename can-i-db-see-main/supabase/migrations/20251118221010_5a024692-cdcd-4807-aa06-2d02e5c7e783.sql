-- Drop the incorrect policies
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assignees can update status of their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins and owners can update any task" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create correct policies using session variables
-- Policy: Users can view tasks in their organization
CREATE POLICY "Users can view tasks in their organization"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
      AND (
        tasks.assignee_id = u.id 
        OR tasks.manager_id = u.id
        OR u.organization_id = (
          SELECT u2.organization_id 
          FROM public.users u2 
          WHERE u2.id = tasks.assignee_id
        )
      )
  )
);

-- Policy: Members can create tasks
CREATE POLICY "Members can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (
  NULLIF(current_setting('app.user_id', true), '')::INTEGER IS NOT NULL
);

-- Policy: Assignees can update status of their assigned tasks
CREATE POLICY "Assignees can update status of their tasks"
ON public.tasks
FOR UPDATE
USING (
  assignee_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
)
WITH CHECK (
  assignee_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
);

-- Policy: Admins and owners can update any task in their org
CREATE POLICY "Admins and owners can update any task"
ON public.tasks
FOR UPDATE
USING (
  public.is_admin_or_owner(
    NULLIF(current_setting('app.user_id', true), '')::INTEGER,
    NULLIF(current_setting('app.organization_id', true), '')::INTEGER
  )
)
WITH CHECK (
  public.is_admin_or_owner(
    NULLIF(current_setting('app.user_id', true), '')::INTEGER,
    NULLIF(current_setting('app.organization_id', true), '')::INTEGER
  )
);

-- Policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (
  user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
);

-- Policy: Admins and owners can manage roles in their org
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (
  public.is_admin_or_owner(
    NULLIF(current_setting('app.user_id', true), '')::INTEGER,
    organization_id
  )
)
WITH CHECK (
  public.is_admin_or_owner(
    NULLIF(current_setting('app.user_id', true), '')::INTEGER,
    organization_id
  )
);