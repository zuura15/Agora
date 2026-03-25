import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { PROVIDERS, PROVIDER_IDS } from '../providers/capabilities';
import { useModelDiscovery } from '../hooks/useModelDiscovery';
import { getTestKeyFn } from '../providers/index';

export function SettingsDrawer() {
  const settingsOpen = useAppStore(s => s.settingsOpen);
  const closeSettings = useAppStore(s => s.closeSettings);
  const apiKeys = useAppStore(s => s.apiKeys);
  const setApiKey = useAppStore(s => s.setApiKey);
  const removeApiKey = useAppStore(s => s.removeApiKey);
  const selectedModels = useAppStore(s => s.selectedModels);
  const setSelectedModel = useAppStore(s => s.setSelectedModel);
  const clearAllData = useAppStore(s => s.clearAllData);
  const { getModelsForProvider } = useModelDiscovery();

  if (!settingsOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={closeSettings}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 max-w-[90vw] bg-surface border-l border-border overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary font-display">Settings</h2>
          <button onClick={closeSettings} className="text-text-secondary hover:text-text-primary text-xs">
            Close
          </button>
        </div>

        {/* API Keys */}
        <section className="px-4 py-4 border-b border-border">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">API Keys</h3>
          <p className="text-[11px] text-text-secondary/70 mb-3 leading-snug">
            Your API keys are saved in your browser's localStorage for convenience. This is not equivalent to server-side secret storage. Anyone with access to your browser profile can read localStorage. Use a dedicated API key for this app and rotate it if you suspect exposure.
          </p>
          {PROVIDER_IDS.map(id => (
            <SettingsKeyRow key={id} providerId={id} />
          ))}
        </section>

        {/* Model Selection */}
        <section className="px-4 py-4 border-b border-border">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Models</h3>
          {PROVIDER_IDS.filter(id => apiKeys[id]).map(id => {
            const models = getModelsForProvider(id);
            return (
              <div key={id} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: PROVIDERS[id].brandColor }}
                  />
                  <span className="text-xs text-text-primary">{PROVIDERS[id].name}</span>
                </div>
                <select
                  value={selectedModels[id] || PROVIDERS[id].defaultModels[0]}
                  onChange={e => setSelectedModel(id, e.target.value)}
                  className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer"
                >
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            );
          })}
          {Object.keys(apiKeys).length === 0 && (
            <p className="text-[11px] text-text-secondary/50">Configure API keys to select models.</p>
          )}
        </section>

        {/* Clear Data */}
        <section className="px-4 py-4">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Data</h3>
          <button
            onClick={() => {
              if (confirm('This will delete all API keys, history, and settings. Are you sure?')) {
                clearAllData();
                closeSettings();
              }
            }}
            className="w-full px-3 py-2 text-xs bg-error/10 border border-error/30 rounded text-error hover:bg-error/20 transition-colors"
          >
            Clear All Data
          </button>
          <p className="text-[10px] text-text-secondary/50 mt-2">
            Removes all API keys from localStorage and clears query history from IndexedDB.
          </p>
        </section>
      </div>
    </>
  );
}

function SettingsKeyRow({ providerId }: { providerId: string }) {
  const apiKeys = useAppStore(s => s.apiKeys);
  const setApiKey = useAppStore(s => s.setApiKey);
  const removeApiKey = useAppStore(s => s.removeApiKey);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState('');
  const hasKey = !!apiKeys[providerId];

  const handleCopy = () => {
    if (apiKeys[providerId]) {
      navigator.clipboard.writeText(apiKeys[providerId]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleTest = async () => {
    const key = apiKeys[providerId];
    if (!key) return;
    setTesting(true);
    setTestResult(null);
    setTestError('');
    try {
      const testFn = getTestKeyFn(providerId);
      const ok = await testFn(key);
      setTestResult(ok ? 'success' : 'error');
      if (!ok) setTestError('Invalid key or API error');
    } catch (err) {
      setTestResult('error');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: PROVIDERS[providerId].brandColor }}
        />
        <span className="text-xs text-text-primary">{PROVIDERS[providerId].name}</span>
        {hasKey && testResult === 'success' && (
          <span className="text-[10px] text-success ml-auto">{'\u2713'} Connected</span>
        )}
        {hasKey && testResult !== 'success' && (
          <span className="text-[10px] text-text-secondary ml-auto">Configured</span>
        )}
      </div>
      <div className="flex gap-2 mb-1">
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKeys[providerId] || ''}
          onChange={e => {
            if (e.target.value) setApiKey(providerId, e.target.value);
            else removeApiKey(providerId);
            setTestResult(null);
          }}
          placeholder={PROVIDERS[providerId].keyPlaceholder}
          className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50 font-mono"
        />
        {hasKey && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-2 py-1 text-[10px] border border-border rounded hover:border-accent/50 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
          >
            {testing ? '...' : 'Test'}
          </button>
        )}
        {hasKey && (
          <button
            onClick={() => removeApiKey(providerId)}
            className="text-[10px] text-error/60 hover:text-error transition-colors px-2"
          >
            Remove
          </button>
        )}
      </div>
      {testResult === 'error' && (
        <p className="text-[10px] text-error mb-1">{testError}</p>
      )}
      {hasKey && (
        <div className="flex gap-2 text-[11px] text-text-secondary">
          <button
            onClick={() => setShowKey(v => !v)}
            className="hover:text-text-primary transition-colors"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
          <span className="text-border">|</span>
          <button
            onClick={handleCopy}
            className="hover:text-text-primary transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
