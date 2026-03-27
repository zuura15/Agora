import { useCallback } from 'react';
import { supabase, APP_URL } from '../lib/supabase';
import { useAuthContext } from './AuthProvider';

type OAuthProvider = 'google' | 'github' | 'twitter';

export function useAuth() {
  const { user, session, isLoggedIn, isLoading } = useAuthContext();

  const loginWith = useCallback(async (provider: OAuthProvider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: APP_URL,
      },
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return { user, session, isLoggedIn, isLoading, loginWith, logout };
}
