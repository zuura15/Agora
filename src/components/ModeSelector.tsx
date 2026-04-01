import { useAppStore } from '../store/appStore';
import type { QueryMode } from '../types/accessCode';

function floorTo2(n: number): string {
  return (Math.floor(n * 100) / 100).toFixed(2);
}

export function ModeSelector() {
  const queryMode = useAppStore(s => s.queryMode);
  const setQueryMode = useAppStore(s => s.setQueryMode);
  const totalBalance = useAppStore(s => s.totalBalance);
  const dailyQueryCount = useAppStore(s => s.dailyQueryCount);
  const dailyQueryLimit = useAppStore(s => s.dailyQueryLimit);
  const accessCodes = useAppStore(s => s.accessCodes);
  const hasAnyKey = Object.keys(useAppStore(s => s.apiKeys)).length > 0;

  const hasActiveCodes = accessCodes.some(c => !c.blocked && c.remaining_credit > 0);

  // Don't show if no access codes
  if (!hasActiveCodes) return null;

  const handleModeChange = (mode: QueryMode) => {
    if (mode === queryMode) return;
    setQueryMode(mode);
  };

  const balanceColor = totalBalance <= 0 ? 'text-error' : 'text-accent';
  const rateLimitColor = dailyQueryCount >= dailyQueryLimit ? 'text-error' : 'text-text-secondary';

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center border border-border rounded-full overflow-hidden">
        {hasAnyKey && (
          <button
            onClick={() => handleModeChange('byok')}
            className={`px-2.5 py-1 text-[11px] font-mono transition-colors ${
              queryMode === 'byok'
                ? 'bg-accent/15 border-r border-accent/40 text-accent'
                : 'border-r border-border bg-surface/50 text-text-secondary hover:text-text-primary'
            }`}
          >
            Own Keys
          </button>
        )}
        <button
          onClick={() => handleModeChange('access-code')}
          className={`px-2.5 py-1 text-[11px] font-mono transition-colors ${
            queryMode === 'access-code'
              ? 'bg-accent/15 text-accent'
              : 'bg-surface/50 text-text-secondary hover:text-text-primary'
          }`}
        >
          Access Code · <span className={balanceColor}>${floorTo2(totalBalance)}</span>
        </button>
      </div>
      {queryMode === 'access-code' && (
        <span className={`text-[10px] font-mono ${rateLimitColor}`}>
          {dailyQueryCount}/{dailyQueryLimit} used · {dailyQueryLimit - dailyQueryCount} remaining
        </span>
      )}
    </div>
  );
}
