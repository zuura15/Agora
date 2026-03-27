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
    let resolved = false;

    function handleSession(newSession: Session | null) {
      setSession(newSession);
      if (!resolved) {
        resolved = true;
        setIsLoading(false);
      }
      if (newSession) {
        startSync(newSession);
        if (localStorage.getItem('agora_migration_done') !== 'true') {
          setShowMigration(true);
        }
      } else {
        stopSync();
      }
    }

    // With detectSessionInUrl: true, Supabase automatically processes
    // any #access_token in the URL hash during client initialization
    // (which happens at import time, before this effect runs).
    // onAuthStateChange fires with SIGNED_IN when that completes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    // Also check for existing session (covers page refreshes)
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Fallback timeout — don't hang forever
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      stopSync();
    };
  }, []);

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
