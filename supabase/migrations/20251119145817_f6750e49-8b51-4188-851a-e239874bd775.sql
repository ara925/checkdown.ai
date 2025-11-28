-- Add auth_user_id to link Supabase Auth users with our users table
ALTER TABLE public.users ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);

-- Update RLS policies to work with Supabase Auth
-- Drop old policies that use session variables
DROP POLICY IF EXISTS "Users can view users in their organization" ON public.users;
DROP POLICY IF EXISTS "Users can update their own record" ON public.users;

-- Create new policies using auth.uid()
CREATE POLICY "Users can view users in their organization"
ON public.users FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()
  )
  OR auth_user_id = auth.uid()
);

CREATE POLICY "Users can update their own record"
ON public.users FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Update other tables' RLS policies to use auth.uid()
-- Tasks policies
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assignees can update status of their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins and owners can update any task" ON public.tasks;

CREATE POLICY "Users can view tasks in their organization"
ON public.tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND (
      tasks.assignee_id = u.id
      OR tasks.manager_id = u.id
      OR u.organization_id = (SELECT organization_id FROM public.users WHERE id = tasks.assignee_id)
    )
  )
);

CREATE POLICY "Members can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Assignees can update status of their tasks"
ON public.tasks FOR UPDATE
USING (
  assignee_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  assignee_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Admins and owners can update any task"
ON public.tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, u.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, u.organization_id)
  )
);

-- Update other key tables
-- Organizations
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
USING (
  id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Departments
DROP POLICY IF EXISTS "Users can view departments in their organization" ON public.departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;

CREATE POLICY "Users can view departments in their organization"
ON public.departments FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Admins can manage departments"
ON public.departments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, organization_id)
  )
);

-- Activity logs
DROP POLICY IF EXISTS "Users can view activity logs in their organization" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can create activity logs" ON public.activity_logs;

CREATE POLICY "Users can view activity logs in their organization"
ON public.activity_logs FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can create activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

-- User roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, organization_id)
  )
);

-- Meetings
DROP POLICY IF EXISTS "Users can view meetings in their organization" ON public.meetings;
DROP POLICY IF EXISTS "Users can create meetings in their organization" ON public.meetings;
DROP POLICY IF EXISTS "Users can update meetings in their organization" ON public.meetings;

CREATE POLICY "Users can view meetings in their organization"
ON public.meetings FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can create meetings in their organization"
ON public.meetings FOR INSERT
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can update meetings in their organization"
ON public.meetings FOR UPDATE
USING (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Accounts vault
DROP POLICY IF EXISTS "Users can view vault entries in their organization" ON public.accounts_vault;
DROP POLICY IF EXISTS "Users can create vault entries in their organization" ON public.accounts_vault;
DROP POLICY IF EXISTS "Users can update vault entries in their organization" ON public.accounts_vault;
DROP POLICY IF EXISTS "Users can delete vault entries in their organization" ON public.accounts_vault;

CREATE POLICY "Users can view vault entries in their organization"
ON public.accounts_vault FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can create vault entries in their organization"
ON public.accounts_vault FOR INSERT
WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can update vault entries in their organization"
ON public.accounts_vault FOR UPDATE
USING (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can delete vault entries in their organization"
ON public.accounts_vault FOR DELETE
USING (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Teams
DROP POLICY IF EXISTS "Users can view teams in their organization" ON public.teams;

CREATE POLICY "Users can view teams in their organization"
ON public.teams FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Team members
DROP POLICY IF EXISTS "Users can view team members in their teams" ON public.team_members;

CREATE POLICY "Users can view team members in their teams"
ON public.team_members FOR SELECT
USING (
  team_id IN (
    SELECT tm.team_id FROM public.team_members tm
    JOIN public.users u ON u.id = tm.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Invitations
DROP POLICY IF EXISTS "Users can view invitations for their teams" ON public.invitations;
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;

CREATE POLICY "Users can view invitations for their teams"
ON public.invitations FOR SELECT
USING (
  team_id IN (
    SELECT tm.team_id FROM public.team_members tm
    JOIN public.users u ON u.id = tm.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage invitations"
ON public.invitations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    JOIN public.users u ON u.auth_user_id = auth.uid()
    WHERE t.id = invitations.team_id
    AND is_admin_or_owner(u.id, t.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    JOIN public.users u ON u.auth_user_id = auth.uid()
    WHERE t.id = invitations.team_id
    AND is_admin_or_owner(u.id, t.organization_id)
  )
);

-- Notification settings
DROP POLICY IF EXISTS "Users can view their own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can insert their own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can update their own notification settings" ON public.notification_settings;

CREATE POLICY "Users can view their own notification settings"
ON public.notification_settings FOR SELECT
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can insert their own notification settings"
ON public.notification_settings FOR INSERT
WITH CHECK (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can update their own notification settings"
ON public.notification_settings FOR UPDATE
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Task links, threads, thread messages, calendar events, transcripts, assets policies
-- (keeping these shorter as they follow same pattern)

DROP POLICY IF EXISTS "Users can view task links for accessible tasks" ON public.task_links;
DROP POLICY IF EXISTS "Users can add task links for accessible tasks" ON public.task_links;
DROP POLICY IF EXISTS "Users can delete task links" ON public.task_links;

CREATE POLICY "Users can view task links for accessible tasks"
ON public.task_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.users u ON u.auth_user_id = auth.uid()
    WHERE t.id = task_links.task_id
    AND (
      t.assignee_id = u.id
      OR t.manager_id = u.id
      OR u.organization_id = (SELECT organization_id FROM public.users WHERE id = t.assignee_id)
    )
  )
);

CREATE POLICY "Users can add task links for accessible tasks"
ON public.task_links FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.users u ON u.auth_user_id = auth.uid()
    WHERE t.id = task_links.task_id
    AND (
      t.assignee_id = u.id
      OR t.manager_id = u.id
      OR u.organization_id = (SELECT organization_id FROM public.users WHERE id = t.assignee_id)
    )
  )
);

CREATE POLICY "Users can delete task links"
ON public.task_links FOR DELETE
USING (
  created_by IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND is_admin_or_owner(u.id, u.organization_id)
  )
);