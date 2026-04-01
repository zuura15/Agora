import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthContext } from '../auth/AuthProvider';
import { useAccessCodes } from '../hooks/useAccessCodes';
import { LoginModal } from '../auth/LoginModal';

export function AccessCodeSection() {
  const { isLoggedIn } = useAuthContext();
  const accessCodes = useAppStore(s => s.accessCodes);
  const { redeem } = useAccessCodes();
  const [codeInput, setCodeInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleRedeem = async () => {
    if (!codeInput.trim()) return;
    setIsRedeeming(true);
    setError(null);
    setSuccess(false);

    const result = await redeem(codeInput.trim());
    setIsRedeeming(false);

    if (result.success) {
      setSuccess(true);
      setCodeInput('');
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Failed to redeem code');
    }
  };

  if (!isLoggedIn) {
    return (
      <div>
        <button
          onClick={() => setShowLogin(true)}
          className="px-4 py-2 text-xs bg-accent/10 border border-accent/30 rounded text-accent hover:bg-accent/20 transition-colors"
        >
          Sign in to use an access code
        </button>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  const getStatusBadge = (code: { blocked: boolean; remaining_credit: number }) => {
    if (code.blocked) return <span className="px-1.5 py-0.5 rounded text-[9px] bg-error/10 text-error border border-error/30">blocked</span>;
    if (code.remaining_credit <= 0) return <span className="px-1.5 py-0.5 rounded text-[9px] bg-text-secondary/10 text-text-secondary border border-border">depleted</span>;
    return <span className="px-1.5 py-0.5 rounded text-[9px] bg-success/10 text-success border border-success/30">active</span>;
  };

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">Access Codes</div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={codeInput}
          onChange={e => { setCodeInput(e.target.value.toUpperCase()); setError(null); }}
          placeholder="AGORA-XXXX-XXXX"
          className="flex-1 bg-bg border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent/50 placeholder:text-text-secondary/50"
          onKeyDown={e => e.key === 'Enter' && handleRedeem()}
        />
        <button
          onClick={handleRedeem}
          disabled={isRedeeming || !codeInput.trim()}
          className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRedeeming ? '...' : 'Redeem'}
        </button>
      </div>

      {/* Feedback */}
      {error && <p className="text-[11px] text-error">{error}</p>}
      {success && <p className="text-[11px] text-success">Code redeemed successfully!</p>}

      {/* Active codes list */}
      {accessCodes.length > 0 && (
        <div className="space-y-1.5">
          {accessCodes.map(code => (
            <div key={code.id} className="flex items-center justify-between text-xs font-mono py-1">
              <span className="text-text-secondary">{code.code}</span>
              <div className="flex items-center gap-2">
                <span className={code.remaining_credit <= 0 ? 'text-text-secondary' : 'text-text-primary'}>
                  ${Number(code.remaining_credit).toFixed(2)}
                </span>
                {getStatusBadge(code)}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-text-secondary">Up to 3 active access codes</p>
    </div>
  );
}
