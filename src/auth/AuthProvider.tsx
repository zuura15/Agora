import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { startSync, stopSync } from '../sync/syncEngine';
import { MigrationDialog } from './MigrationDialog';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoggedIn: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoggedIn: false,
  isLoading: true,
});

/**
 * Parse OAuth tokens from the URL hash (implicit flow).
 * Returns the access_token and refresh_token if present.
 */
function extractTokensFromHash(): { accessToken: string; refreshToken: string } | null {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token') || '';
  if (!accessToken) return null;
  return { accessToken, refreshToken };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    let resolved = false;

    function markLoaded(newSession: Session | null) {
      if (resolved && !newSession) return; // Don't overwrite a session with null after resolved
      resolved = true;
      setSession(newSession);
      setIsLoading(false);
      if (newSession) {
        startSync(newSession);
        checkMigration();
      }
    }

    async function init() {
      // Step 1: Check if we have OAuth tokens in the URL hash
      const tokens = extractTokensFromHash();
      if (tokens) {
        // Clear the hash immediately so it doesn't persist in the URL
        window.history.replaceState(null, '', window.location.pathname);

        // Set the session manually using the extracted tokens
        const { data, error } = await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });

        if (error) {
          console.error('[Auth] setSession from hash failed:', error.message);
        } else if (data.session) {
          markLoaded(data.session);
          return;
        }
      }

      // Step 2: Check for existing session in localStorage
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        markLoaded(session);
        return;
      }

      // Step 3: No session found — mark as loaded (not signed in)
      markLoaded(null);
    }

    init();

    // Listen for subsequent auth changes (sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!resolved) {
        resolved = true;
        setIsLoading(false);
      }
      if (session) {
        startSync(session);
      } else {
        stopSync();
      }
    });

    return () => {
      subscription.unsubscribe();
      stopSync();
    };
  }, []);

  function checkMigration() {
    if (localStorage.getItem('agora_migration_done') !== 'true') {
      setShowMigration(true);
    }
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    isLoggedIn: !!session?.user,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showMigration && <MigrationDialog onClose={() => setShowMigration(false)} />}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
