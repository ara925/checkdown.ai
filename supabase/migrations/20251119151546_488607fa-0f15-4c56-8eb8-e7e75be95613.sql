-- Delete all user-related data in correct order to respect foreign keys

-- Delete child records first
DELETE FROM public.task_links;
DELETE FROM public.thread_messages;
DELETE FROM public.threads;
DELETE FROM public.calendar_events;
DELETE FROM public.transcripts;
DELETE FROM public.assets;

-- Delete task-related data
DELETE FROM public.tasks;

-- Delete activity and notification data
DELETE FROM public.activity_logs;
DELETE FROM public.notification_settings;

-- Delete vault data
DELETE FROM public.accounts_vault;

-- Delete meeting data
DELETE FROM public.meetings;

-- Delete team and user membership data
DELETE FROM public.team_members;
DELETE FROM public.invitations;
DELETE FROM public.user_roles;

-- Delete users (this will cascade to auth.users due to foreign key)
DELETE FROM public.users;

-- Delete teams
DELETE FROM public.teams;

-- Delete departments
DELETE FROM public.departments;

-- Delete organizations
DELETE FROM public.organizations;