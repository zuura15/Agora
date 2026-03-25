import { PROVIDERS } from '../providers/capabilities';
import { useAppStore } from '../store/appStore';

export function ProviderChip({ providerId }: { providerId: string }) {
  const provider = PROVIDERS[providerId];
  const activeProviders = useAppStore(s => s.activeProviders);
  const toggleProvider = useAppStore(s => s.toggleProvider);
  const judgeProvider = useAppStore(s => s.judgeProvider);
  const setJudgeProvider = useAppStore(s => s.setJudgeProvider);
  const isActive = activeProviders.has(providerId);
  const isJudge = judgeProvider === providerId;
  const atMax = activeProviders.size >= 3 && !isActive;

  const handleClick = () => {
    if (atMax) return;
    toggleProvider(providerId);
  };

  const handleJudgeToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJudge) {
      setJudgeProvider(null);
    } else {
      setJudgeProvider(providerId);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={handleClick}
        title={atMax ? 'Max 3 providers active at once' : `Toggle ${provider.name}`}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
          transition-all duration-200 border
          ${isActive
            ? 'border-accent/50 bg-accent/10 text-text-primary'
            : atMax
              ? 'border-border bg-surface/30 text-text-secondary opacity-30 cursor-not-allowed'
              : 'border-border bg-surface/50 text-text-secondary opacity-60 hover:opacity-80'
          }
        `}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: isActive ? provider.brandColor : '#555' }}
        />
        {provider.name}
        {isJudge && (
          <span className="text-[9px] text-amber-400 ml-0.5">JUDGE</span>
        )}
      </button>
      {isActive && (
        <button
          onClick={handleJudgeToggle}
          title={isJudge ? 'Remove as judge' : 'Use as judge/summarizer'}
          className={`
            w-5 h-5 rounded-full text-[9px] flex items-center justify-center
            transition-all duration-200 border
            ${isJudge
              ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
              : 'border-border bg-surface/50 text-text-secondary hover:text-amber-400 hover:border-amber-500/30'
            }
          `}
        >
          J
        </button>
      )}
    </div>
  );
}
