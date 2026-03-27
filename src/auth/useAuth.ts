import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from './AuthProvider';

type OAuthProvider = 'google' | 'github' | 'twitter';

export function useAuth() {
  const { user, session, isLoggedIn, isLoading } = useAuthContext();

  const loginWith = useCallback(async (provider: OAuthProvider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.href,
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
