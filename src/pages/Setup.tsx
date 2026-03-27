import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROVIDER_IDS } from '../providers/capabilities';
import { ProviderCard } from '../components/ProviderCard';
import { useAppStore } from '../store/appStore';
import { useAuth } from '../auth/useAuth';
import { LoginModal } from '../auth/LoginModal';

export function Setup() {
  const navigate = useNavigate();
  const apiKeys = useAppStore(s => s.apiKeys);
  const hasAnyKey = Object.keys(apiKeys).length > 0;
  const { isLoggedIn, user, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Sign in bar */}
        <div className="flex justify-end mb-4">
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {user?.user_metadata?.avatar_url && (
                <img src={user.user_metadata.avatar_url} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs text-text-secondary">{user?.user_metadata?.full_name || user?.email}</span>
              <button onClick={logout} className="text-xs text-text-secondary hover:text-text-primary transition-colors">Sign out</button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Sign in to sync across devices
            </button>
          )}
          {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-extrabold text-text-primary mb-2">
            Set up your AI providers
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
            Argeon sends your queries directly to each provider using your own API key. You pay providers directly. We never see your queries.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {PROVIDER_IDS.map(id => (
            <ProviderCard key={id} providerId={id} />
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            disabled={!hasAnyKey}
            className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start using Argeon
          </button>
          <p className="text-[11px] text-text-secondary/60 mt-3">
            Keys are saved in your browser's local storage. Sign in to sync them across devices.
          </p>
        </div>
      </div>
    </div>
  );
}
