-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create an improved function that handles invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation RECORD;
  v_team RECORD;
  v_user_id INTEGER;
BEGIN
  -- Check for pending invitation
  SELECT i.*, t.organization_id, t.id as team_id
  INTO v_invitation
  FROM invitations i
  JOIN teams t ON t.id = i.team_id
  WHERE i.email = NEW.email
    AND i.status = 'pending'
  LIMIT 1;

  IF FOUND THEN
    -- User has a pending invitation
    -- Create user with organization details from invitation
    INSERT INTO public.users (
      auth_user_id,
      email,
      name,
      password_hash,
      role,
      organization_id
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      '', -- Empty password hash since auth is handled by Supabase
      v_invitation.role,
      v_invitation.organization_id
    )
    RETURNING id INTO v_user_id;

    -- Add user to team
    INSERT INTO team_members (user_id, team_id, role)
    VALUES (v_user_id, v_invitation.team_id, v_invitation.role);

    -- Create user role entry
    INSERT INTO user_roles (user_id, organization_id, role)
    VALUES (v_user_id, v_invitation.organization_id, v_invitation.role::app_role);

    -- Mark invitation as accepted
    UPDATE invitations
    SET status = 'accepted'
    WHERE id = v_invitation.id;

    -- Log activity
    INSERT INTO activity_logs (
      team_id,
      user_id,
      organization_id,
      action,
      related_entity_type,
      related_entity_id
    )
    VALUES (
      v_invitation.team_id,
      v_user_id,
      v_invitation.organization_id,
      'User accepted invitation and joined organization',
      'invitation',
      v_invitation.id
    );

  ELSE
    -- No invitation, create basic user record
    INSERT INTO public.users (
      auth_user_id,
      email,
      name,
      password_hash,
      role
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      '', -- Empty password hash since auth is handled by Supabase
      'member'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();