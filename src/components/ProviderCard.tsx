import { useState } from 'react';
import { PROVIDERS, getBrowserWarning } from '../providers/capabilities';
import { useAppStore } from '../store/appStore';
import { getTestKeyFn } from '../providers/index';

export function ProviderCard({ providerId }: { providerId: string }) {
  const provider = PROVIDERS[providerId];
  const apiKeys = useAppStore(s => s.apiKeys);
  const setApiKey = useAppStore(s => s.setApiKey);
  const removeApiKey = useAppStore(s => s.removeApiKey);
  const [keyInput, setKeyInput] = useState(apiKeys[providerId] || '');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState('');

  const warning = getBrowserWarning(provider);
  const hasKey = !!apiKeys[providerId];

  const handleTest = async () => {
    if (!keyInput.trim()) return;
    setTesting(true);
    setTestResult(null);
    setTestError('');
    try {
      const testFn = getTestKeyFn(providerId);
      const ok = await testFn(keyInput.trim());
      if (ok) {
        setTestResult('success');
        setApiKey(providerId, keyInput.trim());
      } else {
        setTestResult('error');
        setTestError('Invalid key or API error');
      }
    } catch (err) {
      setTestResult('error');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = () => {
    setKeyInput('');
    removeApiKey(providerId);
    setTestResult(null);
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-surface/60 hover:bg-surface/80 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: provider.brandColor }}
        />
        <h3 className="text-sm font-semibold text-text-primary">{provider.name}</h3>
        {hasKey && testResult === 'success' && (
          <span className="text-success text-xs ml-auto">{'\u2713'} Connected</span>
        )}
        {hasKey && testResult !== 'success' && (
          <span className="text-text-secondary text-xs ml-auto">Key saved</span>
        )}
      </div>

      {warning && (
        <div className="mb-3 p-2 rounded border text-[11px] leading-snug" style={{ backgroundColor: 'var(--theme-warning-bg)', borderColor: 'var(--theme-warning-border)', color: 'var(--theme-warning-text)' }}>
          {warning}
        </div>
      )}

      <div className="flex gap-2 mb-1">
        <input
          type={showKey ? 'text' : 'password'}
          value={keyInput}
          onChange={e => { setKeyInput(e.target.value); setTestResult(null); }}
          placeholder={provider.keyPlaceholder}
          className="flex-1 bg-bg border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50 font-mono"
        />
        <button
          onClick={handleTest}
          disabled={!keyInput.trim() || testing}
          className="px-3 py-1.5 text-xs border border-border rounded hover:border-accent/50 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
        >
          {testing ? '...' : 'Validate & Save'}
        </button>
      </div>
      <div className="flex gap-2 mb-2 text-[11px] text-text-secondary">
        <button
          onClick={() => setShowKey(v => !v)}
          className="hover:text-text-primary transition-colors"
        >
          {showKey ? 'Hide' : 'Show'}
        </button>
        {keyInput && (
          <>
            <span className="text-border">|</span>
            <button
              onClick={() => navigator.clipboard.writeText(keyInput)}
              className="hover:text-text-primary transition-colors"
            >
              Copy
            </button>
          </>
        )}
      </div>

      {testResult === 'error' && (
        <p className="text-[11px] text-error mb-2">{testError}</p>
      )}

      <div className="flex items-center justify-between">
        <a
          href={provider.keyDashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-accent hover:text-accent-hover transition-colors"
        >
          Get your key {'\u2192'}
        </a>
        {hasKey && (
          <button
            onClick={handleRemove}
            className="text-[11px] text-error/70 hover:text-error transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
