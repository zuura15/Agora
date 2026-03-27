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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    let loadingTimeout: ReturnType<typeof setTimeout>;
    let resolved = false;

    function markLoaded(newSession: Session | null) {
      if (resolved) return;
      resolved = true;
      clearTimeout(loadingTimeout);
      setSession(newSession);
      setIsLoading(false);
      if (newSession) {
        startSync(newSession);
        checkMigration();
      }
    }

    console.log('[Auth] init, hash:', window.location.hash.slice(0, 50), 'href:', window.location.href.slice(0, 80));

    // Get existing session (fast path — from localStorage)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[Auth] getSession:', session ? 'HAS SESSION' : 'no session', error ? `error: ${error.message}` : '');
      if (session) {
        markLoaded(session);
      }
      // If no session, wait for onAuthStateChange (handles OAuth callback)
    });

    // Listen for auth changes (handles OAuth callback, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] onAuthStateChange:', _event, session ? 'HAS SESSION' : 'no session');
      markLoaded(session);
      // Handle subsequent changes (sign-out, token refresh) after initial load
      if (resolved) {
        setSession(session);
        if (session) {
          startSync(session);
        } else {
          stopSync();
        }
      }
    });

    // Fallback: if neither getSession nor onAuthStateChange resolves within 3s,
    // stop loading anyway so the app doesn't hang
    loadingTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      clearTimeout(loadingTimeout);
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
