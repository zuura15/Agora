import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in hash or query params
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash || window.location.search);

        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');
        if (errorParam) {
          setError(errorDescription || errorParam);
          return;
        }

        // Extract tokens from hash (implicit flow)
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('[AuthCallback] setSession error:', sessionError);
            setError(sessionError.message);
            return;
          }

          // Clear the hash from the URL
          window.history.replaceState(null, '', window.location.pathname);
          navigate('/', { replace: true });
          return;
        }

        // Check for PKCE code in query params
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[AuthCallback] exchange error:', exchangeError);
            setError(exchangeError.message);
            return;
          }
          navigate('/', { replace: true });
          return;
        }

        // No tokens or code found
        setError('No authentication data received');
      } catch (err) {
        console.error('[AuthCallback] error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-lg font-display font-bold text-text-primary mb-2">Sign-in failed</h1>
          <p className="text-sm text-error mb-4">{error}</p>
          <button
            onClick={() => navigate('/setup')}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-hover transition-colors"
          >
            Back to setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-text-secondary">Signing in...</p>
    </div>
  );
}
