


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'member',
    'admin',
    'owner',
    'manager'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_thread_message_edit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE editor INTEGER;
BEGIN
  IF NEW.text IS DISTINCT FROM OLD.text THEN
    SELECT id INTO editor FROM public.users WHERE auth_user_id = auth.uid();
    IF editor IS NULL THEN
      editor := OLD.user_id;
    END IF;
    INSERT INTO public.thread_message_edits(message_id, editor_id, old_text, new_text, edited_at)
    VALUES (OLD.id, editor, OLD.text, NEW.text, now());
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_thread_message_edit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dm_room_includes_user"("_room" "text", "_user_id" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE a INTEGER; b INTEGER; part TEXT;
BEGIN
  IF _room IS NULL THEN RETURN FALSE; END IF;
  IF LEFT(_room, 3) <> 'dm:' THEN RETURN FALSE; END IF;
  part := split_part(_room, ':', 2);
  a := split_part(part, '-', 1)::INTEGER;
  b := split_part(part, '-', 2)::INTEGER;
  RETURN _user_id = a OR _user_id = b;
END;
$$;


ALTER FUNCTION "public"."dm_room_includes_user"("_room" "text", "_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dm_thread_accessible"("_thread_id" integer, "_user_id" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE room TEXT;
BEGIN
  SELECT matrix_room_id INTO room FROM public.threads WHERE id = _thread_id;
  RETURN public.dm_room_includes_user(room, _user_id);
END;
$$;


ALTER FUNCTION "public"."dm_thread_accessible"("_thread_id" integer, "_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_team_ids"("_auth_user_id" "uuid") RETURNS SETOF integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT t.id 
  FROM teams t
  INNER JOIN users u ON u.organization_id = t.organization_id
  WHERE u.auth_user_id = _auth_user_id;
$$;


ALTER FUNCTION "public"."get_org_team_ids"("_auth_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organization_id"("_auth_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT organization_id
  FROM public.users
  WHERE auth_user_id = _auth_user_id
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_organization_id"("_auth_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_team_ids"("_auth_user_id" "uuid") RETURNS SETOF integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT tm.team_id 
  FROM team_members tm
  INNER JOIN users u ON u.id = tm.user_id
  WHERE u.auth_user_id = _auth_user_id;
$$;


ALTER FUNCTION "public"."get_user_team_ids"("_auth_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" integer, "_role" "public"."app_role", "_org_id" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND organization_id = _org_id
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" integer, "_role" "public"."app_role", "_org_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_owner"("_user_id" integer, "_org_id" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('admin', 'owner')
  )
$$;


ALTER FUNCTION "public"."is_admin_or_owner"("_user_id" integer, "_org_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_department_delete_with_members"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE department_id = OLD.id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Cannot delete department with active members';
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."prevent_department_delete_with_members"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_session_variables"("_user_id" integer, "_organization_id" integer, "_department_id" integer, "_role" character varying) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM set_config('app.user_id', _user_id::TEXT, false);
  PERFORM set_config('app.organization_id', _organization_id::TEXT, false);
  PERFORM set_config('app.department_id', _department_id::TEXT, false);
  PERFORM set_config('app.role', _role, false);
END;
$$;


ALTER FUNCTION "public"."set_session_variables"("_user_id" integer, "_organization_id" integer, "_department_id" integer, "_role" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_thread_messages_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_thread_messages_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tasks_enforce_reassign_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org_id INTEGER;
  v_team_id INTEGER;
  v_user_id INTEGER;
BEGIN
  IF OLD.state = 'pending_review' AND NEW.state = 'assigned' THEN
    IF COALESCE(NEW.review_comment, '') = '' THEN
      RAISE EXCEPTION 'Reassignment requires comment';
    END IF;

    SELECT organization_id INTO v_org_id
    FROM public.users
    WHERE id = COALESCE(NEW.assignee_id, NEW.manager_id)
    LIMIT 1;

    SELECT id INTO v_team_id
    FROM public.teams
    WHERE organization_id = v_org_id
    ORDER BY id
    LIMIT 1;

    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_user_id = auth.uid();

    INSERT INTO public.activity_logs(
      team_id,
      user_id,
      organization_id,
      action,
      related_entity_type,
      related_entity_id
    )
    VALUES (
      v_team_id,
      v_user_id,
      v_org_id,
      'Task returned to assigned: ' || NEW.review_comment,
      'task',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tasks_enforce_reassign_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_pending_request_for_org"("_requesting_user_id" integer, "_viewer_auth_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_join_requests ojr
    WHERE ojr.user_id = _requesting_user_id
      AND ojr.status = 'pending'
      AND ojr.organization_id = (
        SELECT organization_id 
        FROM public.users 
        WHERE auth_user_id = _viewer_auth_id
        LIMIT 1
      )
  )
$$;


ALTER FUNCTION "public"."user_has_pending_request_for_org"("_requesting_user_id" integer, "_viewer_auth_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts_vault" (
    "id" integer NOT NULL,
    "organization_id" integer,
    "client_name" character varying(200) NOT NULL,
    "service" character varying(100) NOT NULL,
    "url" character varying(500),
    "username" character varying(200),
    "notes" "text",
    "tags_json" "text",
    "secret_ciphertext" "text",
    "secret_iv" "text",
    "secret_auth_tag" "text",
    "created_by" integer,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp without time zone
);


ALTER TABLE "public"."accounts_vault" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."accounts_vault_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."accounts_vault_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."accounts_vault_id_seq" OWNED BY "public"."accounts_vault"."id";



CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" integer NOT NULL,
    "team_id" integer NOT NULL,
    "user_id" integer,
    "action" "text" NOT NULL,
    "timestamp" timestamp without time zone DEFAULT "now"() NOT NULL,
    "ip_address" character varying(45),
    "organization_id" integer,
    "related_entity_type" character varying(50),
    "related_entity_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."activity_logs"."related_entity_type" IS 'Type of entity affected (e.g., task, meeting, department)';



COMMENT ON COLUMN "public"."activity_logs"."related_entity_id" IS 'ID of the affected entity';



CREATE SEQUENCE IF NOT EXISTS "public"."activity_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."activity_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."activity_logs_id_seq" OWNED BY "public"."activity_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" integer NOT NULL,
    "meeting_id" integer,
    "provider" character varying(50),
    "playback_id" character varying(255),
    "duration_seconds" integer,
    "status" character varying(30),
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."assets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."assets_id_seq" OWNED BY "public"."assets"."id";



CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" integer NOT NULL,
    "task_id" integer,
    "provider" character varying(50),
    "external_id" character varying(255),
    "start_at" timestamp without time zone,
    "end_at" timestamp without time zone
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."calendar_events_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."calendar_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."calendar_events_id_seq" OWNED BY "public"."calendar_events"."id";



CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" integer NOT NULL,
    "organization_id" integer NOT NULL,
    "name" character varying(150) NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" integer NOT NULL,
    "name" character varying(100),
    "email" character varying(255) NOT NULL,
    "password_hash" "text" NOT NULL,
    "role" character varying(20) DEFAULT 'member'::character varying NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp without time zone,
    "organization_id" integer,
    "department_id" integer,
    "auth_user_id" "uuid"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."department_stats" AS
 SELECT "d"."id",
    "d"."name",
    "d"."organization_id",
    (COALESCE("count"("u"."id"), (0)::bigint))::integer AS "member_count"
   FROM ("public"."departments" "d"
     LEFT JOIN "public"."users" "u" ON ((("u"."department_id" = "d"."id") AND ("u"."deleted_at" IS NULL))))
  GROUP BY "d"."id", "d"."name", "d"."organization_id";


ALTER VIEW "public"."department_stats" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."departments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."departments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."departments_id_seq" OWNED BY "public"."departments"."id";



CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" integer NOT NULL,
    "team_id" integer NOT NULL,
    "email" character varying(255) NOT NULL,
    "role" character varying(50) NOT NULL,
    "invited_by" integer NOT NULL,
    "invited_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "token" "text"
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invitations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invitations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."invitations_id_seq" OWNED BY "public"."invitations"."id";



CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" integer NOT NULL,
    "organization_id" integer,
    "platform" character varying(50),
    "external_id" character varying(255),
    "start_at" timestamp without time zone,
    "end_at" timestamp without time zone,
    "participants_json" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."meetings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."meetings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."meetings_id_seq" OWNED BY "public"."meetings"."id";



CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" integer NOT NULL,
    "user_id" integer,
    "sms_enabled" character varying(5) DEFAULT 'false'::character varying,
    "email_enabled" character varying(5) DEFAULT 'true'::character varying,
    "quiet_hours_json" "text",
    "locale" character varying(10)
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notification_settings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notification_settings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notification_settings_id_seq" OWNED BY "public"."notification_settings"."id";



CREATE TABLE IF NOT EXISTS "public"."organization_join_requests" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "organization_id" integer NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "requested_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp without time zone,
    "reviewed_by" integer
);


ALTER TABLE "public"."organization_join_requests" OWNER TO "postgres";


ALTER TABLE "public"."organization_join_requests" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."organization_join_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" integer NOT NULL,
    "name" character varying(150) NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."organizations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."organizations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."organizations_id_seq" OWNED BY "public"."organizations"."id";



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."push_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."push_subscriptions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."push_subscriptions_id_seq" OWNED BY "public"."push_subscriptions"."id";



CREATE TABLE IF NOT EXISTS "public"."task_links" (
    "id" integer NOT NULL,
    "task_id" integer NOT NULL,
    "url" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "created_by" integer
);


ALTER TABLE "public"."task_links" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."task_links_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."task_links_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."task_links_id_seq" OWNED BY "public"."task_links"."id";



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" integer NOT NULL,
    "meeting_id" integer,
    "department_id" integer,
    "assignee_id" integer,
    "manager_id" integer,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "start_seconds" integer,
    "deadline_at" timestamp without time zone,
    "state" character varying(20) DEFAULT 'unassigned'::character varying NOT NULL,
    "confidence" integer,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp without time zone,
    "review_comment" "text",
    CONSTRAINT "tasks_state_valid" CHECK ((("state")::"text" = ANY ((ARRAY['unassigned'::character varying, 'assigned'::character varying, 'pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tasks_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tasks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tasks_id_seq" OWNED BY "public"."tasks"."id";



CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "team_id" integer NOT NULL,
    "role" character varying(50) NOT NULL,
    "joined_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."team_members_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."team_members_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."team_members_id_seq" OWNED BY "public"."team_members"."id";



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_product_id" "text",
    "plan_name" character varying(50),
    "subscription_status" character varying(20),
    "organization_id" integer
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."teams_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."teams_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."teams_id_seq" OWNED BY "public"."teams"."id";



CREATE TABLE IF NOT EXISTS "public"."thread_message_edits" (
    "id" bigint NOT NULL,
    "message_id" bigint NOT NULL,
    "editor_id" integer NOT NULL,
    "edited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_text" "text" NOT NULL,
    "new_text" "text" NOT NULL
);


ALTER TABLE "public"."thread_message_edits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."thread_message_edits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."thread_message_edits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."thread_message_edits_id_seq" OWNED BY "public"."thread_message_edits"."id";



CREATE TABLE IF NOT EXISTS "public"."thread_message_reactions" (
    "id" bigint NOT NULL,
    "message_id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."thread_message_reactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."thread_message_reactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."thread_message_reactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."thread_message_reactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."thread_message_reactions_id_seq" OWNED BY "public"."thread_message_reactions"."id";



CREATE TABLE IF NOT EXISTS "public"."thread_message_receipts" (
    "id" bigint NOT NULL,
    "message_id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."thread_message_receipts" REPLICA IDENTITY FULL;


ALTER TABLE "public"."thread_message_receipts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."thread_message_receipts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."thread_message_receipts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."thread_message_receipts_id_seq" OWNED BY "public"."thread_message_receipts"."id";



CREATE TABLE IF NOT EXISTS "public"."thread_messages" (
    "id" integer NOT NULL,
    "thread_id" integer,
    "user_id" integer,
    "text" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."thread_messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."thread_messages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."thread_messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."thread_messages_id_seq" OWNED BY "public"."thread_messages"."id";



CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" integer NOT NULL,
    "task_id" integer,
    "matrix_room_id" character varying(255)
);


ALTER TABLE "public"."threads" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."threads_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."threads_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."threads_id_seq" OWNED BY "public"."threads"."id";



CREATE TABLE IF NOT EXISTS "public"."transcripts" (
    "id" integer NOT NULL,
    "meeting_id" integer,
    "provider" character varying(50),
    "language" character varying(20),
    "segments_json" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transcripts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transcripts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transcripts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transcripts_id_seq" OWNED BY "public"."transcripts"."id";



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" integer NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "organization_id" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_id_seq" OWNED BY "public"."users"."id";



ALTER TABLE ONLY "public"."accounts_vault" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."accounts_vault_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."activity_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."activity_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."calendar_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."calendar_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."departments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."departments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."invitations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."invitations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."meetings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."meetings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notification_settings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notification_settings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."organizations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."organizations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."push_subscriptions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."push_subscriptions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."task_links" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."task_links_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tasks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tasks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."team_members" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."team_members_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."teams" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."teams_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."thread_message_edits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."thread_message_edits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."thread_message_reactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."thread_message_reactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."thread_message_receipts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."thread_message_receipts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."thread_messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."thread_messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."threads" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."threads_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transcripts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transcripts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accounts_vault"
    ADD CONSTRAINT "accounts_vault_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_join_requests"
    ADD CONSTRAINT "organization_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_join_requests"
    ADD CONSTRAINT "organization_join_requests_user_id_organization_id_key" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_links"
    ADD CONSTRAINT "task_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_stripe_customer_id_unique" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_stripe_subscription_id_unique" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."thread_message_edits"
    ADD CONSTRAINT "thread_message_edits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_message_reactions"
    ADD CONSTRAINT "thread_message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."thread_message_reactions"
    ADD CONSTRAINT "thread_message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_message_receipts"
    ADD CONSTRAINT "thread_message_receipts_message_id_user_id_key" UNIQUE ("message_id", "user_id");



ALTER TABLE ONLY "public"."thread_message_receipts"
    ADD CONSTRAINT "thread_message_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_messages"
    ADD CONSTRAINT "thread_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transcripts"
    ADD CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_organization_id_key" UNIQUE ("user_id", "role", "organization_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "departments_org_name_unique" ON "public"."departments" USING "btree" ("organization_id", "lower"(("name")::"text"));



CREATE INDEX "idx_accounts_vault_org" ON "public"."accounts_vault" USING "btree" ("organization_id");



CREATE INDEX "idx_activity_logs_entity" ON "public"."activity_logs" USING "btree" ("related_entity_type", "related_entity_id");



CREATE INDEX "idx_invitations_token" ON "public"."invitations" USING "btree" ("token");



CREATE INDEX "idx_org_join_requests_status" ON "public"."organization_join_requests" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_org_join_requests_user" ON "public"."organization_join_requests" USING "btree" ("user_id");



CREATE INDEX "idx_push_subscriptions_user_id" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_task_links_task_id" ON "public"."task_links" USING "btree" ("task_id");



CREATE INDEX "idx_tasks_assignee_active" ON "public"."tasks" USING "btree" ("assignee_id") WHERE (("assignee_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_tasks_created_at" ON "public"."tasks" USING "btree" ("created_at");



CREATE INDEX "idx_tasks_deadline_active" ON "public"."tasks" USING "btree" ("deadline_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_deleted_nonnull" ON "public"."tasks" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "idx_tasks_description_trgm" ON "public"."tasks" USING "gin" ("description" "public"."gin_trgm_ops");



CREATE INDEX "idx_tasks_manager_active" ON "public"."tasks" USING "btree" ("manager_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_state_active" ON "public"."tasks" USING "btree" ("state") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_title_trgm" ON "public"."tasks" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_threads_matrix_room_id" ON "public"."threads" USING "btree" ("matrix_room_id");



CREATE INDEX "idx_tme_editor_id" ON "public"."thread_message_edits" USING "btree" ("editor_id");



CREATE INDEX "idx_tme_message_id" ON "public"."thread_message_edits" USING "btree" ("message_id");



CREATE INDEX "idx_tmr_message_id" ON "public"."thread_message_reactions" USING "btree" ("message_id");



CREATE INDEX "idx_tmr_user_id" ON "public"."thread_message_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_tmrct_message_id" ON "public"."thread_message_receipts" USING "btree" ("message_id");



CREATE INDEX "idx_tmrct_user_id" ON "public"."thread_message_receipts" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_org_role" ON "public"."user_roles" USING "btree" ("organization_id", "role");



CREATE INDEX "idx_user_roles_user_org" ON "public"."user_roles" USING "btree" ("user_id", "organization_id");



CREATE INDEX "idx_users_auth_user_id" ON "public"."users" USING "btree" ("auth_user_id");



CREATE INDEX "idx_users_org_name" ON "public"."users" USING "btree" ("organization_id", "name");



CREATE OR REPLACE TRIGGER "audit_thread_message_edit" BEFORE UPDATE ON "public"."thread_messages" FOR EACH ROW EXECUTE FUNCTION "public"."audit_thread_message_edit"();



CREATE OR REPLACE TRIGGER "set_thread_messages_updated_at" BEFORE UPDATE ON "public"."thread_messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_thread_messages_updated_at"();



CREATE OR REPLACE TRIGGER "tasks_enforce_reassign_comment" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."tasks_enforce_reassign_comment"();



CREATE OR REPLACE TRIGGER "trg_prevent_department_delete_with_members" BEFORE DELETE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_department_delete_with_members"();



ALTER TABLE ONLY "public"."accounts_vault"
    ADD CONSTRAINT "accounts_vault_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."accounts_vault"
    ADD CONSTRAINT "accounts_vault_org_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounts_vault"
    ADD CONSTRAINT "accounts_vault_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."organization_join_requests"
    ADD CONSTRAINT "organization_join_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_join_requests"
    ADD CONSTRAINT "organization_join_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."organization_join_requests"
    ADD CONSTRAINT "organization_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_links"
    ADD CONSTRAINT "task_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."task_links"
    ADD CONSTRAINT "task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."thread_message_edits"
    ADD CONSTRAINT "thread_message_edits_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."thread_message_edits"
    ADD CONSTRAINT "thread_message_edits_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_message_reactions"
    ADD CONSTRAINT "thread_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_message_reactions"
    ADD CONSTRAINT "thread_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_message_receipts"
    ADD CONSTRAINT "thread_message_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_message_receipts"
    ADD CONSTRAINT "thread_message_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_messages"
    ADD CONSTRAINT "thread_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id");



ALTER TABLE ONLY "public"."thread_messages"
    ADD CONSTRAINT "thread_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."transcripts"
    ADD CONSTRAINT "transcripts_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



CREATE POLICY "Admins and owners can delete tasks" ON "public"."tasks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id") AND ((EXISTS ( SELECT 1
           FROM "public"."users" "u_assignee"
          WHERE (("u_assignee"."id" = "tasks"."assignee_id") AND ("u_assignee"."organization_id" = "u"."organization_id")))) OR (EXISTS ( SELECT 1
           FROM "public"."users" "u_manager"
          WHERE (("u_manager"."id" = "tasks"."manager_id") AND ("u_manager"."organization_id" = "u"."organization_id")))))))));



CREATE POLICY "Admins and owners can update any task" ON "public"."tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id")))));



CREATE POLICY "Admins can delete users except owners" ON "public"."users" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u"."id", 'admin'::"public"."app_role", "users"."organization_id")))) AND (("role")::"text" <> 'owner'::"text")));



CREATE POLICY "Admins can manage departments" ON "public"."departments" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id")))));



CREATE POLICY "Admins can manage invitations" ON "public"."invitations" USING ((EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."users" "u" ON (("u"."auth_user_id" = "auth"."uid"())))
  WHERE (("t"."id" = "invitations"."team_id") AND "public"."is_admin_or_owner"("u"."id", "t"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."users" "u" ON (("u"."auth_user_id" = "auth"."uid"())))
  WHERE (("t"."id" = "invitations"."team_id") AND "public"."is_admin_or_owner"("u"."id", "t"."organization_id")))));



CREATE POLICY "Admins can manage member and manager roles" ON "public"."user_roles" USING (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u"."id", 'admin'::"public"."app_role", "user_roles"."organization_id")))) AND ("role" <> ALL (ARRAY['admin'::"public"."app_role", 'owner'::"public"."app_role"])))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u"."id", 'admin'::"public"."app_role", "user_roles"."organization_id")))) AND ("role" <> ALL (ARRAY['admin'::"public"."app_role", 'owner'::"public"."app_role"]))));



CREATE POLICY "Admins can update org members" ON "public"."users" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id") AND (("users"."organization_id" = "u"."organization_id") OR ("users"."organization_id" IS NULL)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id") AND ("users"."organization_id" = "u"."organization_id")))));



CREATE POLICY "Admins can update requests" ON "public"."organization_join_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."organization_id" = "organization_join_requests"."organization_id") AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id")))));



CREATE POLICY "Admins can update users except owners" ON "public"."users" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u"."id", 'admin'::"public"."app_role", "users"."organization_id")))) AND (("role")::"text" <> 'owner'::"text"))) WITH CHECK ((("role")::"text" <> 'owner'::"text"));



CREATE POLICY "Admins can view DM thread messages" ON "public"."thread_messages" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", ( SELECT "users"."organization_id"
           FROM "public"."users"
          WHERE ("users"."id" = "thread_messages"."user_id")))))) AND (EXISTS ( SELECT 1
   FROM "public"."threads" "th"
  WHERE (("th"."id" = "thread_messages"."thread_id") AND (("th"."matrix_room_id")::"text" ~~ 'dm:%'::"text"))))));



CREATE POLICY "Admins can view org requests" ON "public"."organization_join_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."organization_id" = "organization_join_requests"."organization_id") AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id")))));



CREATE POLICY "Admins manage roles except owner" ON "public"."user_roles" USING (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u"."id", 'admin'::"public"."app_role", "user_roles"."organization_id")))) AND ("role" <> 'owner'::"public"."app_role"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u"."id", 'admin'::"public"."app_role", "user_roles"."organization_id")))) AND ("role" <> 'owner'::"public"."app_role")));



CREATE POLICY "Admins/Owners can create tasks in org" ON "public"."tasks" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id")))) AND (("assignee_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."organization_id" = ( SELECT "users_1"."organization_id"
           FROM "public"."users" "users_1"
          WHERE ("users_1"."auth_user_id" = "auth"."uid"()))))) OR ("manager_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."organization_id" = ( SELECT "users_1"."organization_id"
           FROM "public"."users" "users_1"
          WHERE ("users_1"."auth_user_id" = "auth"."uid"()))))))));



CREATE POLICY "Admins/Owners can delete tasks" ON "public"."tasks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id")))));



CREATE POLICY "Assignees can update status of their tasks" ON "public"."tasks" FOR UPDATE USING (("assignee_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("assignee_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Authors can insert message edits" ON "public"."thread_message_edits" FOR INSERT WITH CHECK (("editor_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Managers can create tasks in org" ON "public"."tasks" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users" "u_act"
  WHERE ("u_act"."auth_user_id" = "auth"."uid"()))) AND (("manager_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))) OR ("assignee_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."organization_id" = ( SELECT "users_1"."organization_id"
           FROM "public"."users" "users_1"
          WHERE ("users_1"."auth_user_id" = "auth"."uid"()))))))));



CREATE POLICY "Managers can create tasks in organization" ON "public"."tasks" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users" "u_act"
  WHERE (("u_act"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u_act"."id", 'manager'::"public"."app_role", "u_act"."organization_id")))) AND (("assignee_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."organization_id" = ( SELECT "users_1"."organization_id"
           FROM "public"."users" "users_1"
          WHERE ("users_1"."auth_user_id" = "auth"."uid"()))))) OR ("manager_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."organization_id" = ( SELECT "users_1"."organization_id"
           FROM "public"."users" "users_1"
          WHERE ("users_1"."auth_user_id" = "auth"."uid"()))))))));



CREATE POLICY "Managers can delete managed tasks" ON "public"."tasks" FOR DELETE USING (("manager_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Managers can delete tasks in department" ON "public"."tasks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u_act"
  WHERE (("u_act"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u_act"."id", 'manager'::"public"."app_role", "u_act"."organization_id") AND ((EXISTS ( SELECT 1
           FROM "public"."users" "u_assignee"
          WHERE (("u_assignee"."id" = "tasks"."assignee_id") AND ("u_assignee"."department_id" = "u_act"."department_id")))) OR (EXISTS ( SELECT 1
           FROM "public"."users" "u_manager"
          WHERE (("u_manager"."id" = "tasks"."manager_id") AND ("u_manager"."department_id" = "u_act"."department_id")))))))));



CREATE POLICY "Managers can update managed tasks" ON "public"."tasks" FOR UPDATE USING (("manager_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("manager_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Managers can update tasks in department" ON "public"."tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u_act"
  WHERE (("u_act"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u_act"."id", 'manager'::"public"."app_role", "u_act"."organization_id") AND ((EXISTS ( SELECT 1
           FROM "public"."users" "u_assignee"
          WHERE (("u_assignee"."id" = "tasks"."assignee_id") AND ("u_assignee"."department_id" = "u_act"."department_id")))) OR (EXISTS ( SELECT 1
           FROM "public"."users" "u_manager"
          WHERE (("u_manager"."id" = "tasks"."manager_id") AND ("u_manager"."department_id" = "u_act"."department_id"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u_act"
  WHERE (("u_act"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u_act"."id", 'manager'::"public"."app_role", "u_act"."organization_id") AND ((EXISTS ( SELECT 1
           FROM "public"."users" "u_assignee"
          WHERE (("u_assignee"."id" = "tasks"."assignee_id") AND ("u_assignee"."department_id" = "u_act"."department_id")))) OR (EXISTS ( SELECT 1
           FROM "public"."users" "u_manager"
          WHERE (("u_manager"."id" = "tasks"."manager_id") AND ("u_manager"."department_id" = "u_act"."department_id")))))))));



CREATE POLICY "Managers can update their managed tasks" ON "public"."tasks" FOR UPDATE USING (("manager_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("manager_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Members can create own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("assignee_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Owners can manage roles" ON "public"."user_roles" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u"."id", 'owner'::"public"."app_role", "user_roles"."organization_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."has_role"("u"."id", 'owner'::"public"."app_role", "user_roles"."organization_id")))));



CREATE POLICY "Participants can view message edits" ON "public"."thread_message_edits" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."thread_messages" "tm"
     JOIN "public"."threads" "th" ON (("th"."id" = "tm"."thread_id")))
  WHERE (("tm"."id" = "thread_message_edits"."message_id") AND (("th"."matrix_room_id")::"text" ~~ 'dm:%'::"text") AND "public"."dm_room_includes_user"(("th"."matrix_room_id")::"text", ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_user_id" = "auth"."uid"())))))));



CREATE POLICY "Restore deleted tasks allowed for manager/admin" ON "public"."tasks" FOR UPDATE USING ((("deleted_at" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer) AND (("u"."id" = "tasks"."manager_id") OR "public"."is_admin_or_owner"("u"."id", "u"."organization_id"))))))) WITH CHECK (("deleted_at" IS NULL));



CREATE POLICY "Tasks allow restore deleted" ON "public"."tasks" FOR UPDATE USING (("deleted_at" IS NOT NULL)) WITH CHECK (("deleted_at" IS NULL));



CREATE POLICY "Tasks allow update for not deleted" ON "public"."tasks" FOR UPDATE USING (("deleted_at" IS NULL)) WITH CHECK (("deleted_at" IS NULL));



CREATE POLICY "Update active tasks only" ON "public"."tasks" FOR UPDATE USING ((("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer) AND (("u"."id" = "tasks"."assignee_id") OR ("u"."id" = "tasks"."manager_id") OR "public"."is_admin_or_owner"("u"."id", "u"."organization_id"))))))) WITH CHECK ((("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer) AND (("u"."id" = "tasks"."assignee_id") OR ("u"."id" = "tasks"."manager_id") OR "public"."is_admin_or_owner"("u"."id", "u"."organization_id")))))));



CREATE POLICY "Users can add reactions for accessible messages" ON "public"."thread_message_reactions" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."thread_messages" "tm"
  WHERE ("tm"."id" = "thread_message_reactions"."message_id"))) AND ("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can add receipts for accessible messages" ON "public"."thread_message_receipts" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."thread_messages" "tm"
  WHERE ("tm"."id" = "thread_message_receipts"."message_id"))) AND ("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can add task links for accessible tasks" ON "public"."task_links" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."tasks" "t"
     JOIN "public"."users" "u" ON (("u"."auth_user_id" = "auth"."uid"())))
  WHERE (("t"."id" = "task_links"."task_id") AND (("t"."assignee_id" = "u"."id") OR ("t"."manager_id" = "u"."id") OR ("u"."organization_id" = ( SELECT "users"."organization_id"
           FROM "public"."users"
          WHERE ("users"."id" = "t"."assignee_id"))))))));



CREATE POLICY "Users can create DM thread messages" ON "public"."thread_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."threads" "th"
  WHERE (("th"."id" = "thread_messages"."thread_id") AND "public"."dm_room_includes_user"(("th"."matrix_room_id")::"text", ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can create DM threads they participate in" ON "public"."threads" FOR INSERT WITH CHECK (((("matrix_room_id")::"text" ~~ 'dm:%'::"text") AND "public"."dm_room_includes_user"(("matrix_room_id")::"text", ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create DM threads with themselves as a participant" ON "public"."threads" FOR INSERT WITH CHECK (((("matrix_room_id")::"text" ~~ 'dm:%'::"text") AND (((("regexp_match"(("matrix_room_id")::"text", '^dm:(\d+)-(\d+)$'::"text"))[1])::integer = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer) OR ((("regexp_match"(("matrix_room_id")::"text", '^dm:(\d+)-(\d+)$'::"text"))[2])::integer = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer))));



CREATE POLICY "Users can create activity logs" ON "public"."activity_logs" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create join requests" ON "public"."organization_join_requests" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create meetings in their organization" ON "public"."meetings" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create thread messages for accessible threads" ON "public"."thread_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."threads" "th"
     JOIN "public"."tasks" "t" ON (("t"."id" = "th"."task_id")))
     JOIN "public"."users" "u" ON (("u"."id" = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer)))
  WHERE (("th"."id" = "thread_messages"."thread_id") AND (("t"."assignee_id" = "u"."id") OR ("t"."manager_id" = "u"."id") OR (EXISTS ( SELECT 1
           FROM "public"."users" "u2"
          WHERE (("u2"."id" = "t"."assignee_id") AND ("u2"."organization_id" = "u"."organization_id")))))))));



CREATE POLICY "Users can create vault entries in their organization" ON "public"."accounts_vault" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete task links" ON "public"."task_links" FOR DELETE USING ((("created_by" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND "public"."is_admin_or_owner"("u"."id", "u"."organization_id"))))));



CREATE POLICY "Users can delete their own DM thread messages" ON "public"."thread_messages" FOR DELETE USING ((("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."threads" "th"
  WHERE (("th"."id" = "thread_messages"."thread_id") AND (("th"."matrix_room_id")::"text" ~~ 'dm:%'::"text") AND "public"."dm_room_includes_user"(("th"."matrix_room_id")::"text", ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can delete their own push subscriptions" ON "public"."push_subscriptions" FOR DELETE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete vault entries in their organization" ON "public"."accounts_vault" FOR DELETE USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own notification settings" ON "public"."notification_settings" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own push subscriptions" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can remove their own reactions" ON "public"."thread_message_reactions" FOR DELETE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can search organizations by name" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can update meetings in their organization" ON "public"."meetings" FOR UPDATE USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their notification settings" ON "public"."notification_settings" FOR UPDATE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own DM thread messages" ON "public"."thread_messages" FOR UPDATE USING ((("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))) AND (("now"() - ("created_at")::timestamp with time zone) <= '00:02:00'::interval) AND (EXISTS ( SELECT 1
   FROM "public"."threads" "th"
  WHERE (("th"."id" = "thread_messages"."thread_id") AND (("th"."matrix_room_id")::"text" ~~ 'dm:%'::"text") AND "public"."dm_room_includes_user"(("th"."matrix_room_id")::"text", ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_user_id" = "auth"."uid"())))))))) WITH CHECK ((("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))) AND (("now"() - ("created_at")::timestamp with time zone) <= '00:02:00'::interval)));



CREATE POLICY "Users can update their own notification settings" ON "public"."notification_settings" FOR UPDATE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own receipts" ON "public"."thread_message_receipts" FOR UPDATE USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own record" ON "public"."users" FOR UPDATE USING (("auth_user_id" = "auth"."uid"())) WITH CHECK (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can update vault entries in their organization" ON "public"."accounts_vault" FOR UPDATE USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can upsert their notification settings" ON "public"."notification_settings" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view DM thread messages" ON "public"."thread_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."threads" "th"
  WHERE (("th"."id" = "thread_messages"."thread_id") AND "public"."dm_room_includes_user"(("th"."matrix_room_id")::"text", ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view DM thread messages they participate in" ON "public"."thread_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."threads" "th"
  WHERE (("th"."id" = "thread_messages"."thread_id") AND (("th"."matrix_room_id")::"text" ~~ 'dm:%'::"text") AND (((("regexp_match"(("th"."matrix_room_id")::"text", '^dm:(\d+)-(\d+)$'::"text"))[1])::integer = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer) OR ((("regexp_match"(("th"."matrix_room_id")::"text", '^dm:(\d+)-(\d+)$'::"text"))[2])::integer = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer))))));



CREATE POLICY "Users can view DM threads they participate in" ON "public"."threads" FOR SELECT USING (((("matrix_room_id")::"text" ~~ 'dm:%'::"text") AND "public"."dm_room_includes_user"(("matrix_room_id")::"text", ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view activity logs in their organization" ON "public"."activity_logs" FOR SELECT USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view assets for meetings in their organization" ON "public"."assets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "assets"."meeting_id") AND ("m"."organization_id" = (NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))::integer)))));



CREATE POLICY "Users can view calendar events for accessible tasks" ON "public"."calendar_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."tasks" "t"
     JOIN "public"."users" "u" ON (("u"."id" = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer)))
  WHERE (("t"."id" = "calendar_events"."task_id") AND (("t"."assignee_id" = "u"."id") OR ("t"."manager_id" = "u"."id") OR (EXISTS ( SELECT 1
           FROM "public"."users" "u2"
          WHERE (("u2"."id" = "t"."assignee_id") AND ("u2"."organization_id" = "u"."organization_id")))))))));



CREATE POLICY "Users can view departments in their organization" ON "public"."departments" FOR SELECT USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view invitations for their teams" ON "public"."invitations" FOR SELECT USING (("team_id" IN ( SELECT "tm"."team_id"
   FROM ("public"."team_members" "tm"
     JOIN "public"."users" "u" ON (("u"."id" = "tm"."user_id")))
  WHERE ("u"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view join request users" ON "public"."users" FOR SELECT TO "authenticated" USING ("public"."user_has_pending_request_for_org"("id", "auth"."uid"()));



CREATE POLICY "Users can view meetings in their organization" ON "public"."meetings" FOR SELECT USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view org members" ON "public"."users" FOR SELECT USING ((("auth_user_id" = "auth"."uid"()) OR (("organization_id" IS NOT NULL) AND ("organization_id" = "public"."get_user_organization_id"("auth"."uid"())))));



CREATE POLICY "Users can view own requests" ON "public"."organization_join_requests" FOR SELECT USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view reactions for accessible messages" ON "public"."thread_message_reactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."thread_messages" "tm"
  WHERE ("tm"."id" = "thread_message_reactions"."message_id"))));



CREATE POLICY "Users can view receipts for accessible messages" ON "public"."thread_message_receipts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."thread_messages" "tm"
  WHERE ("tm"."id" = "thread_message_receipts"."message_id"))));



CREATE POLICY "Users can view task links for accessible tasks" ON "public"."task_links" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."tasks" "t"
     JOIN "public"."users" "u" ON (("u"."auth_user_id" = "auth"."uid"())))
  WHERE (("t"."id" = "task_links"."task_id") AND (("t"."assignee_id" = "u"."id") OR ("t"."manager_id" = "u"."id") OR ("u"."organization_id" = ( SELECT "users"."organization_id"
           FROM "public"."users"
          WHERE ("users"."id" = "t"."assignee_id"))))))));



CREATE POLICY "Users can view tasks in their organization" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("tasks"."assignee_id" = "u"."id") OR ("tasks"."manager_id" = "u"."id") OR ("u"."organization_id" = ( SELECT "users"."organization_id"
           FROM "public"."users"
          WHERE ("users"."id" = "tasks"."assignee_id"))))))));



CREATE POLICY "Users can view team_members in their teams or org" ON "public"."team_members" FOR SELECT USING ((("team_id" IN ( SELECT "public"."get_user_team_ids"("auth"."uid"()) AS "get_user_team_ids")) OR ("team_id" IN ( SELECT "public"."get_org_team_ids"("auth"."uid"()) AS "get_org_team_ids"))));



CREATE POLICY "Users can view teams in their organization" ON "public"."teams" FOR SELECT USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their notification settings" ON "public"."notification_settings" FOR SELECT USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their organization" ON "public"."organizations" FOR SELECT USING (("id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own notification settings" ON "public"."notification_settings" FOR SELECT USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own push subscriptions" ON "public"."push_subscriptions" FOR SELECT USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own record" ON "public"."users" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own team_member record" ON "public"."team_members" FOR SELECT USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "Users can view thread messages for accessible threads" ON "public"."thread_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."threads" "th"
     JOIN "public"."tasks" "t" ON (("t"."id" = "th"."task_id")))
     JOIN "public"."users" "u" ON (("u"."id" = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer)))
  WHERE (("th"."id" = "thread_messages"."thread_id") AND (("t"."assignee_id" = "u"."id") OR ("t"."manager_id" = "u"."id") OR (EXISTS ( SELECT 1
           FROM "public"."users" "u2"
          WHERE (("u2"."id" = "t"."assignee_id") AND ("u2"."organization_id" = "u"."organization_id")))))))));



CREATE POLICY "Users can view threads for accessible tasks" ON "public"."threads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."tasks" "t"
     JOIN "public"."users" "u" ON (("u"."id" = (NULLIF("current_setting"('app.user_id'::"text", true), ''::"text"))::integer)))
  WHERE (("t"."id" = "threads"."task_id") AND (("t"."assignee_id" = "u"."id") OR ("t"."manager_id" = "u"."id") OR (EXISTS ( SELECT 1
           FROM "public"."users" "u2"
          WHERE (("u2"."id" = "t"."assignee_id") AND ("u2"."organization_id" = "u"."organization_id")))))))));



CREATE POLICY "Users can view transcripts for meetings in their organization" ON "public"."transcripts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "transcripts"."meeting_id") AND ("m"."organization_id" = (NULLIF("current_setting"('app.organization_id'::"text", true), ''::"text"))::integer)))));



CREATE POLICY "Users can view vault entries in their organization" ON "public"."accounts_vault" FOR SELECT USING (("organization_id" IN ( SELECT "users"."organization_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."accounts_vault" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_message_edits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_message_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_message_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transcripts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."thread_message_edits";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."thread_message_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."thread_message_receipts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."thread_messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."audit_thread_message_edit"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_thread_message_edit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_thread_message_edit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dm_room_includes_user"("_room" "text", "_user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."dm_room_includes_user"("_room" "text", "_user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dm_room_includes_user"("_room" "text", "_user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."dm_thread_accessible"("_thread_id" integer, "_user_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."dm_thread_accessible"("_thread_id" integer, "_user_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dm_thread_accessible"("_thread_id" integer, "_user_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_team_ids"("_auth_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_team_ids"("_auth_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_team_ids"("_auth_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organization_id"("_auth_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organization_id"("_auth_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organization_id"("_auth_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_team_ids"("_auth_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_team_ids"("_auth_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_team_ids"("_auth_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" integer, "_role" "public"."app_role", "_org_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" integer, "_role" "public"."app_role", "_org_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" integer, "_role" "public"."app_role", "_org_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_owner"("_user_id" integer, "_org_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_owner"("_user_id" integer, "_org_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_owner"("_user_id" integer, "_org_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_department_delete_with_members"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_department_delete_with_members"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_department_delete_with_members"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_session_variables"("_user_id" integer, "_organization_id" integer, "_department_id" integer, "_role" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."set_session_variables"("_user_id" integer, "_organization_id" integer, "_department_id" integer, "_role" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_session_variables"("_user_id" integer, "_organization_id" integer, "_department_id" integer, "_role" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_thread_messages_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_thread_messages_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_thread_messages_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tasks_enforce_reassign_comment"() TO "anon";
GRANT ALL ON FUNCTION "public"."tasks_enforce_reassign_comment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tasks_enforce_reassign_comment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_pending_request_for_org"("_requesting_user_id" integer, "_viewer_auth_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_pending_request_for_org"("_requesting_user_id" integer, "_viewer_auth_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_pending_request_for_org"("_requesting_user_id" integer, "_viewer_auth_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."accounts_vault" TO "anon";
GRANT ALL ON TABLE "public"."accounts_vault" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts_vault" TO "service_role";



GRANT ALL ON SEQUENCE "public"."accounts_vault_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."accounts_vault_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."accounts_vault_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activity_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."calendar_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."calendar_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."calendar_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."department_stats" TO "anon";
GRANT ALL ON TABLE "public"."department_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."department_stats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."departments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."departments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."departments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invitations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invitations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invitations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."meetings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."meetings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."meetings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notification_settings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notification_settings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notification_settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."organization_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."organization_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_join_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."organization_join_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."organization_join_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."organization_join_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."organizations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."organizations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."organizations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."push_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."task_links" TO "anon";
GRANT ALL ON TABLE "public"."task_links" TO "authenticated";
GRANT ALL ON TABLE "public"."task_links" TO "service_role";



GRANT ALL ON SEQUENCE "public"."task_links_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."task_links_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."task_links_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."team_members_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."team_members_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."team_members_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."thread_message_edits" TO "anon";
GRANT ALL ON TABLE "public"."thread_message_edits" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_message_edits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."thread_message_edits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."thread_message_edits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."thread_message_edits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."thread_message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."thread_message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_message_reactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."thread_message_reactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."thread_message_reactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."thread_message_reactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."thread_message_receipts" TO "anon";
GRANT ALL ON TABLE "public"."thread_message_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_message_receipts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."thread_message_receipts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."thread_message_receipts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."thread_message_receipts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."thread_messages" TO "anon";
GRANT ALL ON TABLE "public"."thread_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."thread_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."thread_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."thread_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";



GRANT ALL ON SEQUENCE "public"."threads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."threads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."threads_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transcripts" TO "anon";
GRANT ALL ON TABLE "public"."transcripts" TO "authenticated";
GRANT ALL ON TABLE "public"."transcripts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transcripts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transcripts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transcripts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































