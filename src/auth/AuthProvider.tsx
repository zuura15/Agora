import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { startSync, stopSync } from '../sync/syncEngine';
import { MigrationDialog } from './MigrationDialog';
import { logger } from '../lib/logger';
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

    logger.auth.info('init', {
      url: window.location.href.slice(0, 100),
      hasHash: window.location.hash.length > 1,
      hashPreview: window.location.hash.slice(0, 30),
    });

    function handleSession(newSession: Session | null) {
      logger.auth.info('handleSession', {
        hasSession: !!newSession,
        email: newSession?.user?.email,
        alreadyResolved: resolved,
      });
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      logger.auth.info('onAuthStateChange', { event: _event, hasSession: !!session });
      handleSession(session);
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logger.auth.error('getSession failed', { message: error.message });
      } else {
        logger.auth.info('getSession', { hasSession: !!session });
      }
      handleSession(session);
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        logger.auth.warn('timeout — marking as loaded without session');
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
