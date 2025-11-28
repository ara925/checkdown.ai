-- Enable RLS on all tables missing protection
ALTER TABLE public.accounts_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policies for accounts_vault (organization-scoped)
CREATE POLICY "Users can view vault entries in their organization"
ON public.accounts_vault FOR SELECT
USING (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

CREATE POLICY "Users can create vault entries in their organization"
ON public.accounts_vault FOR INSERT
WITH CHECK (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

CREATE POLICY "Users can update vault entries in their organization"
ON public.accounts_vault FOR UPDATE
USING (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

CREATE POLICY "Users can delete vault entries in their organization"
ON public.accounts_vault FOR DELETE
USING (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

-- Policies for users (own record + org members)
CREATE POLICY "Users can view their own record"
ON public.users FOR SELECT
USING (id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER);

CREATE POLICY "Users can update their own record"
ON public.users FOR UPDATE
USING (id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER);

-- Policies for organizations (members can view their org)
CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
USING (id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

-- Policies for departments (organization-scoped)
CREATE POLICY "Users can view departments in their organization"
ON public.departments FOR SELECT
USING (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

CREATE POLICY "Admins can manage departments"
ON public.departments FOR ALL
USING (is_admin_or_owner((NULLIF(current_setting('app.user_id', true), ''))::INTEGER, organization_id));

-- Policies for teams (organization-scoped)
CREATE POLICY "Users can view teams in their organization"
ON public.teams FOR SELECT
USING (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

-- Policies for team_members (team-scoped)
CREATE POLICY "Users can view team members in their teams"
ON public.team_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.user_id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  AND tm.team_id = team_members.team_id
));

-- Policies for meetings (organization-scoped)
CREATE POLICY "Users can view meetings in their organization"
ON public.meetings FOR SELECT
USING (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

CREATE POLICY "Users can create meetings in their organization"
ON public.meetings FOR INSERT
WITH CHECK (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

CREATE POLICY "Users can update meetings in their organization"
ON public.meetings FOR UPDATE
USING (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

-- Policies for assets (linked to meetings)
CREATE POLICY "Users can view assets for meetings in their organization"
ON public.assets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.meetings m
  WHERE m.id = assets.meeting_id
  AND m.organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER
));

-- Policies for transcripts (linked to meetings)
CREATE POLICY "Users can view transcripts for meetings in their organization"
ON public.transcripts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.meetings m
  WHERE m.id = transcripts.meeting_id
  AND m.organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER
));

-- Policies for calendar_events (linked to tasks)
CREATE POLICY "Users can view calendar events for accessible tasks"
ON public.calendar_events FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  JOIN public.users u ON u.id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  WHERE t.id = calendar_events.task_id
  AND (t.assignee_id = u.id OR t.manager_id = u.id OR EXISTS (
    SELECT 1 FROM public.users u2
    WHERE u2.id = t.assignee_id AND u2.organization_id = u.organization_id
  ))
));

-- Policies for activity_logs (organization-scoped)
CREATE POLICY "Users can view activity logs in their organization"
ON public.activity_logs FOR SELECT
USING (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

CREATE POLICY "Users can create activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (organization_id = (NULLIF(current_setting('app.organization_id', true), ''))::INTEGER);

-- Policies for invitations (team-scoped)
CREATE POLICY "Users can view invitations for their teams"
ON public.invitations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.user_id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  AND tm.team_id = invitations.team_id
));

CREATE POLICY "Admins can manage invitations"
ON public.invitations FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = invitations.team_id
  AND is_admin_or_owner((NULLIF(current_setting('app.user_id', true), ''))::INTEGER, t.organization_id)
));

-- Policies for notification_settings (own settings only)
CREATE POLICY "Users can view their own notification settings"
ON public.notification_settings FOR SELECT
USING (user_id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER);

CREATE POLICY "Users can update their own notification settings"
ON public.notification_settings FOR UPDATE
USING (user_id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER);

CREATE POLICY "Users can insert their own notification settings"
ON public.notification_settings FOR INSERT
WITH CHECK (user_id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER);

-- Policies for threads (linked to tasks)
CREATE POLICY "Users can view threads for accessible tasks"
ON public.threads FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  JOIN public.users u ON u.id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  WHERE t.id = threads.task_id
  AND (t.assignee_id = u.id OR t.manager_id = u.id OR EXISTS (
    SELECT 1 FROM public.users u2
    WHERE u2.id = t.assignee_id AND u2.organization_id = u.organization_id
  ))
));

-- Policies for thread_messages (linked to threads)
CREATE POLICY "Users can view thread messages for accessible threads"
ON public.thread_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.threads th
  JOIN public.tasks t ON t.id = th.task_id
  JOIN public.users u ON u.id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  WHERE th.id = thread_messages.thread_id
  AND (t.assignee_id = u.id OR t.manager_id = u.id OR EXISTS (
    SELECT 1 FROM public.users u2
    WHERE u2.id = t.assignee_id AND u2.organization_id = u.organization_id
  ))
));

CREATE POLICY "Users can create thread messages for accessible threads"
ON public.thread_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.threads th
  JOIN public.tasks t ON t.id = th.task_id
  JOIN public.users u ON u.id = (NULLIF(current_setting('app.user_id', true), ''))::INTEGER
  WHERE th.id = thread_messages.thread_id
  AND (t.assignee_id = u.id OR t.manager_id = u.id OR EXISTS (
    SELECT 1 FROM public.users u2
    WHERE u2.id = t.assignee_id AND u2.organization_id = u.organization_id
  ))
));