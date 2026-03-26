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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      if (session) {
        startSync(session);
        checkMigration();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
      if (session) {
        startSync(session);
        checkMigration();
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
