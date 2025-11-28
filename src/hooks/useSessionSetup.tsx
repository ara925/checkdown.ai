import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";

// Helper function to set session variables - can be called before any query
export async function setSessionVariables() {
  // Try localStorage first
  const userData = localStorage.getItem("user");
  if (!userData) {
    console.warn('[Session] No user data in localStorage, skipping session setup');
    return false;
  }

  try {
    const user = JSON.parse(userData);
    
    if (!user.id) {
      console.warn('[Session] User data missing id, skipping session setup');
      return false;
    }
    
    const { error } = await supabase.rpc('set_session_variables', {
      _user_id: user.id,
      _organization_id: user.organization_id || null,
      _department_id: user.department_id || null,
      _role: user.role || 'member'
    });

    if (error) {
      console.error('[Session] Failed to set session variables:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Session] Setup error:', error);
    return false;
  }
}

export function useSessionSetup() {
  const [isReady, setIsReady] = useState(false);
  const { user, loading } = useAuth();
  const setupAttempted = useRef(false);
  const lastUserId = useRef<number | null>(null);

  useEffect(() => {
    // Don't attempt setup if auth is still loading
    if (loading) {
      return;
    }

    // If no user, mark as ready with false state (will show appropriate UI)
    if (!user) {
      setIsReady(false);
      setupAttempted.current = false;
      lastUserId.current = null;
      return;
    }

    // Skip if we already set up for this user
    if (setupAttempted.current && lastUserId.current === user.id) {
      return;
    }

    const setupSession = async () => {
      // Sync user to localStorage for session variables
      try {
        localStorage.setItem("user", JSON.stringify({
          id: user.id,
          organization_id: user.organization_id,
          department_id: user.department_id,
          role: user.role,
          team_id: user.team_id
        }));
      } catch (e) {
        console.error('[Session] Failed to sync user to localStorage:', e);
      }

      const success = await setSessionVariables();
      setupAttempted.current = true;
      lastUserId.current = user.id;
      setIsReady(success);
      
      if (!success) {
        console.warn('[Session] Session setup failed, retrying in 1s...');
        // Retry once after a delay
        setTimeout(async () => {
          const retrySuccess = await setSessionVariables();
          setIsReady(retrySuccess);
        }, 1000);
      }
    };

    setupSession();
  }, [user, loading]);

  return isReady;
}
