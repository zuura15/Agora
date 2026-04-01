import { useAppStore } from '../store/appStore';

export function ZeroBalanceBanner() {
  const queryMode = useAppStore(s => s.queryMode);
  const totalBalance = useAppStore(s => s.totalBalance);
  const dailyQueryCount = useAppStore(s => s.dailyQueryCount);
  const dailyQueryLimit = useAppStore(s => s.dailyQueryLimit);

  if (queryMode !== 'access-code') return null;

  if (totalBalance <= 0) {
    return (
      <div className="flex items-center justify-center px-4 h-8 text-xs bg-error/5 border-b border-error/20 text-error/80 shrink-0">
        <span>Access credit depleted</span>
        <span className="mx-2">·</span>
        <a
          href="mailto:?subject=Request%20More%20Argeon%20Access"
          className="text-accent hover:text-accent-hover underline"
        >
          Request More Access
        </a>
      </div>
    );
  }

  if (dailyQueryCount >= dailyQueryLimit) {
    return (
      <div className="flex items-center justify-center px-4 h-8 text-xs bg-warning-bg border-b border-warning-border text-warning-text shrink-0">
        Daily query limit reached. Resets at midnight PST.
      </div>
    );
  }

  return null;
}
