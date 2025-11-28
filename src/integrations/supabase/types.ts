export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts_vault: {
        Row: {
          client_name: string
          created_at: string
          created_by: number | null
          deleted_at: string | null
          id: number
          notes: string | null
          organization_id: number | null
          secret_auth_tag: string | null
          secret_ciphertext: string | null
          secret_iv: string | null
          service: string
          tags_json: string | null
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          client_name: string
          created_at?: string
          created_by?: number | null
          deleted_at?: string | null
          id?: number
          notes?: string | null
          organization_id?: number | null
          secret_auth_tag?: string | null
          secret_ciphertext?: string | null
          secret_iv?: string | null
          service: string
          tags_json?: string | null
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: number | null
          deleted_at?: string | null
          id?: number
          notes?: string | null
          organization_id?: number | null
          secret_auth_tag?: string | null
          secret_ciphertext?: string | null
          secret_iv?: string | null
          service?: string
          tags_json?: string | null
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_vault_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_vault_org_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_vault_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: number
          ip_address: string | null
          organization_id: number | null
          related_entity_id: number | null
          related_entity_type: string | null
          team_id: number
          timestamp: string
          user_id: number | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          ip_address?: string | null
          organization_id?: number | null
          related_entity_id?: number | null
          related_entity_type?: string | null
          team_id: number
          timestamp?: string
          user_id?: number | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          ip_address?: string | null
          organization_id?: number | null
          related_entity_id?: number | null
          related_entity_type?: string | null
          team_id?: number
          timestamp?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_team_id_teams_id_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_users_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: number
          meeting_id: number | null
          playback_id: string | null
          provider: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: number
          meeting_id?: number | null
          playback_id?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: number
          meeting_id?: number | null
          playback_id?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          end_at: string | null
          external_id: string | null
          id: number
          provider: string | null
          start_at: string | null
          task_id: number | null
        }
        Insert: {
          end_at?: string | null
          external_id?: string | null
          id?: number
          provider?: string | null
          start_at?: string | null
          task_id?: number | null
        }
        Update: {
          end_at?: string | null
          external_id?: string | null
          id?: number
          provider?: string | null
          start_at?: string | null
          task_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: number
          initiator_id: number
          receiver_id: number | null
          room_key: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: number
          initiator_id: number
          receiver_id?: number | null
          room_key: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: number
          initiator_id?: number
          receiver_id?: number | null
          room_key?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: number
          name: string
          organization_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          organization_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          organization_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          email: string
          id: number
          invited_at: string
          invited_by: number
          role: string
          status: string
          team_id: number
          token: string | null
        }
        Insert: {
          email: string
          id?: number
          invited_at?: string
          invited_by: number
          role: string
          status?: string
          team_id: number
          token?: string | null
        }
        Update: {
          email?: string
          id?: number
          invited_at?: string
          invited_by?: number
          role?: string
          status?: string
          team_id?: number
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_users_id_fk"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_team_id_teams_id_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          end_at: string | null
          external_id: string | null
          id: number
          organization_id: number | null
          participants_json: string | null
          platform: string | null
          start_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          external_id?: string | null
          id?: number
          organization_id?: number | null
          participants_json?: string | null
          platform?: string | null
          start_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_at?: string | null
          external_id?: string | null
          id?: number
          organization_id?: number | null
          participants_json?: string | null
          platform?: string | null
          start_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          email_enabled: string | null
          id: number
          locale: string | null
          quiet_hours_json: string | null
          sms_enabled: string | null
          user_id: number | null
        }
        Insert: {
          email_enabled?: string | null
          id?: number
          locale?: string | null
          quiet_hours_json?: string | null
          sms_enabled?: string | null
          user_id?: number | null
        }
        Update: {
          email_enabled?: string | null
          id?: number
          locale?: string | null
          quiet_hours_json?: string | null
          sms_enabled?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_join_requests: {
        Row: {
          id: number
          organization_id: number
          requested_at: string
          reviewed_at: string | null
          reviewed_by: number | null
          status: string
          user_id: number
        }
        Insert: {
          id?: never
          organization_id: number
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: number | null
          status?: string
          user_id: number
        }
        Update: {
          id?: never
          organization_id?: number
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: number | null
          status?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_join_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          p256dh: string
          user_id: number
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: number
          p256dh: string
          user_id: number
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: number
          p256dh?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          created_by: number | null
          description: string | null
          id: number
          task_id: number
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          description?: string | null
          id?: number
          task_id: number
          url: string
        }
        Update: {
          created_at?: string
          created_by?: number | null
          description?: string | null
          id?: number
          task_id?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: number | null
          confidence: number | null
          created_at: string
          deadline_at: string | null
          deleted_at: string | null
          department_id: number | null
          description: string | null
          id: number
          manager_id: number | null
          meeting_id: number | null
          review_comment: string | null
          start_seconds: number | null
          state: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: number | null
          confidence?: number | null
          created_at?: string
          deadline_at?: string | null
          deleted_at?: string | null
          department_id?: number | null
          description?: string | null
          id?: number
          manager_id?: number | null
          meeting_id?: number | null
          review_comment?: string | null
          start_seconds?: number | null
          state?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: number | null
          confidence?: number | null
          created_at?: string
          deadline_at?: string | null
          deleted_at?: string | null
          department_id?: number | null
          description?: string | null
          id?: number
          manager_id?: number | null
          meeting_id?: number | null
          review_comment?: string | null
          start_seconds?: number | null
          state?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: number
          joined_at: string
          role: string
          team_id: number
          user_id: number
        }
        Insert: {
          id?: number
          joined_at?: string
          role: string
          team_id: number
          user_id: number
        }
        Update: {
          id?: number
          joined_at?: string
          role?: string
          team_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_teams_id_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_users_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: number
          name: string
          organization_id: number | null
          plan_name: string | null
          stripe_customer_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          organization_id?: number | null
          plan_name?: string | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          organization_id?: number | null
          plan_name?: string | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_message_edits: {
        Row: {
          edited_at: string
          editor_id: number
          id: number
          message_id: number
          new_text: string
          old_text: string
        }
        Insert: {
          edited_at?: string
          editor_id: number
          id?: number
          message_id: number
          new_text: string
          old_text: string
        }
        Update: {
          edited_at?: string
          editor_id?: number
          id?: number
          message_id?: number
          new_text?: string
          old_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_message_edits_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_message_edits_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: number
          message_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: number
          message_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: number
          message_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "thread_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_message_receipts: {
        Row: {
          id: number
          message_id: number
          read_at: string
          user_id: number
        }
        Insert: {
          id?: number
          message_id: number
          read_at?: string
          user_id: number
        }
        Update: {
          id?: number
          message_id?: number
          read_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "thread_message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_message_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          created_at: string
          id: number
          text: string
          thread_id: number | null
          updated_at: string
          user_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          text: string
          thread_id?: number | null
          updated_at?: string
          user_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          text?: string
          thread_id?: number | null
          updated_at?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          id: number
          matrix_room_id: string | null
          task_id: number | null
        }
        Insert: {
          id?: number
          matrix_room_id?: string | null
          task_id?: number | null
        }
        Update: {
          id?: number
          matrix_room_id?: string | null
          task_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "threads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          created_at: string
          id: number
          language: string | null
          meeting_id: number | null
          provider: string | null
          segments_json: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          language?: string | null
          meeting_id?: number | null
          provider?: string | null
          segments_json?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          language?: string | null
          meeting_id?: number | null
          provider?: string | null
          segments_json?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: number
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          deleted_at: string | null
          department_id: number | null
          email: string
          id: number
          name: string | null
          organization_id: number | null
          password_hash: string
          role: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: number | null
          email: string
          id?: number
          name?: string | null
          organization_id?: number | null
          password_hash: string
          role?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: number | null
          email?: string
          id?: number
          name?: string | null
          organization_id?: number | null
          password_hash?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      department_stats: {
        Row: {
          id: number | null
          member_count: number | null
          name: string | null
          organization_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      dm_room_includes_user: {
        Args: { _room: string; _user_id: number }
        Returns: boolean
      }
      dm_thread_accessible: {
        Args: { _thread_id: number; _user_id: number }
        Returns: boolean
      }
      get_org_team_ids: { Args: { _auth_user_id: string }; Returns: number[] }
      get_user_organization_id: {
        Args: { _auth_user_id: string }
        Returns: number
      }
      get_user_team_ids: { Args: { _auth_user_id: string }; Returns: number[] }
      has_role: {
        Args: {
          _org_id: number
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: number
        }
        Returns: boolean
      }
      is_admin_or_owner: {
        Args: { _org_id: number; _user_id: number }
        Returns: boolean
      }
      set_session_variables: {
        Args: {
          _department_id: number
          _organization_id: number
          _role: string
          _user_id: number
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_has_pending_request_for_org: {
        Args: { _requesting_user_id: number; _viewer_auth_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "member" | "admin" | "owner" | "manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["member", "admin", "owner", "manager"],
    },
  },
} as const
