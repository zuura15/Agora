import { useNavigate } from 'react-router-dom';
import { PROVIDER_IDS } from '../providers/capabilities';
import { ProviderCard } from '../components/ProviderCard';
import { useAppStore } from '../store/appStore';

export function Setup() {
  const navigate = useNavigate();
  const apiKeys = useAppStore(s => s.apiKeys);
  const hasAnyKey = Object.keys(apiKeys).length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
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
