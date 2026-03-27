import { useState } from 'react';
import { useAuth } from './useAuth';

interface Props {
  onClose: () => void;
}

export function LoginModal({ onClose }: Props) {
  const { loginWith } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (provider: 'google' | 'github' | 'twitter') => {
    setLoading(provider);
    setError(null);
    try {
      await loginWith(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-display font-bold text-text-primary mb-1">Sign in to Argeon</h2>
          <p className="text-xs text-text-secondary mb-5">
            Sync your API keys and settings across devices. Optional — the app works fully without an account.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleLogin('google')}
              disabled={!!loading}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm text-text-primary hover:border-accent/50 transition-colors disabled:opacity-50"
            >
              {loading === 'google' ? '...' : 'Continue with Google'}
            </button>
            <button
              disabled
              className="flex items-center justify-between w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm text-text-secondary opacity-50 cursor-not-allowed"
            >
              Continue with GitHub
              <span className="text-[10px] text-text-secondary/60">Coming soon</span>
            </button>
            <button
              disabled
              className="flex items-center justify-between w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-sm text-text-secondary opacity-50 cursor-not-allowed"
            >
              Continue with X
              <span className="text-[10px] text-text-secondary/60">Coming soon</span>
            </button>
          </div>

          {error && (
            <p className="text-[11px] text-error mt-3">{error}</p>
          )}

          <button
            onClick={onClose}
            className="w-full mt-4 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
