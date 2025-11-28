import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  organization_id: number | null;
  department_id: number | null;
  team_id?: number | null;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  supabaseUser: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (authUserId: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", authUserId)
        .single();

      if (error) throw error;
      if (data) {
        // Fetch team_id from team_members - handle RLS errors gracefully
        let teamId: number | null = null;
        try {
          const { data: teamMember, error: teamError } = await supabase
            .from("team_members")
            .select("team_id")
            .eq("user_id", data.id)
            .maybeSingle();
          
          if (teamError) {
            // Log but don't fail - team_id is optional
            console.warn("Failed to fetch team_id, using fallback:", teamError.message);
          } else if (teamMember) {
            teamId = teamMember.team_id;
          }
        } catch (teamErr) {
          // Silently handle team fetch errors
          console.warn("Team fetch error:", teamErr);
        }
        
        // Also try to get team_id from teams table via organization
        if (!teamId && data.organization_id) {
          try {
            const { data: team } = await supabase
              .from("teams")
              .select("id")
              .eq("organization_id", data.organization_id)
              .limit(1)
              .maybeSingle();
            if (team?.id) {
              teamId = team.id;
            }
          } catch {
            // Ignore - this is a fallback
          }
        }
        
        setUser({ ...data, team_id: teamId });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
    navigate("/sign-in");
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
