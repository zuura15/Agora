import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { PROVIDERS, PROVIDER_IDS } from '../providers/capabilities';
import { useModelDiscovery } from '../hooks/useModelDiscovery';
import { getTestKeyFn } from '../providers/index';
import { useAuth } from '../auth/useAuth';
import { LoginModal } from '../auth/LoginModal';
import { useHistoryStore } from '../store/historyStore';

type Tab = 'general' | 'display' | 'data' | 'account';

export function SettingsDrawer() {
  const settingsOpen = useAppStore(s => s.settingsOpen);
  const closeSettings = useAppStore(s => s.closeSettings);
  const [activeTab, setActiveTab] = useState<Tab>('general');

  if (!settingsOpen) return null;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'display', label: 'Display' },
    { id: 'data', label: 'Data' },
    { id: 'account', label: 'Account' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={closeSettings} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 max-w-[90vw] bg-surface border-l border-border overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary font-display">Settings</h2>
          <button onClick={closeSettings} className="text-text-secondary hover:text-text-primary text-xs">
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'display' && <DisplayTab />}
          {activeTab === 'data' && <DataTab />}
          {activeTab === 'account' && <AccountTab />}
        </div>
      </div>
    </>
  );
}

// ── Toggle helper ──

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between mb-3 py-1">
      <div>
        <p className="text-[11px] text-text-primary">{label}</p>
        {desc && <p className="text-[10px] text-text-secondary">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${value ? 'bg-accent' : 'bg-border'}`}
      >
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

// ── General Tab ──

function GeneralTab() {
  const apiKeys = useAppStore(s => s.apiKeys);
  const selectedModels = useAppStore(s => s.selectedModels);
  const setSelectedModel = useAppStore(s => s.setSelectedModel);
  const responseLength = useAppStore(s => s.responseLength);
  const setResponseLength = useAppStore(s => s.setResponseLength);
  const temperature = useAppStore(s => s.temperature);
  const setTemperature = useAppStore(s => s.setTemperature);
  const autoJudge = useAppStore(s => s.autoJudge);
  const setAutoJudge = useAppStore(s => s.setAutoJudge);
  const sendKey = useAppStore(s => s.sendKey);
  const setSendKey = useAppStore(s => s.setSendKey);
  const { getModelsForProvider } = useModelDiscovery();

  const lengthOptions: Array<{ value: 'normal' | 'brief' | 'superbrief'; label: string; desc: string }> = [
    { value: 'normal', label: 'Normal', desc: 'Full detailed responses' },
    { value: 'brief', label: 'Brief', desc: '2-3 sentences, bullet points' },
    { value: 'superbrief', label: 'Super brief', desc: '1-2 sentences max' },
  ];

  return (
    <div className="space-y-5">
      {/* API Keys */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">API Keys</h3>
        <p className="text-[10px] text-text-secondary/70 mb-2 leading-snug">
          Saved in localStorage. Use dedicated keys with spending limits.
        </p>
        {PROVIDER_IDS.map(id => (
          <SettingsKeyRow key={id} providerId={id} />
        ))}
      </div>

      {/* Models */}
      {Object.keys(apiKeys).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Models</h3>
          {PROVIDER_IDS.filter(id => apiKeys[id]).map(id => {
            const models = getModelsForProvider(id);
            return (
              <div key={id} className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDERS[id].brandColor }} />
                  <span className="text-[11px] text-text-primary">{PROVIDERS[id].name}</span>
                </div>
                <select
                  value={selectedModels[id] || PROVIDERS[id].defaultModels[0]}
                  onChange={e => setSelectedModel(id, e.target.value)}
                  className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer"
                >
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Response Length */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Response Length</h3>
        <div className="flex gap-1">
          {lengthOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setResponseLength(opt.value)}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] transition-colors border ${
                responseLength === opt.value
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg border-border text-text-secondary hover:text-text-primary'
              }`}
              title={opt.desc}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-text-secondary/60 mt-1">
          {lengthOptions.find(o => o.value === responseLength)?.desc}
        </p>
      </div>

      {/* Temperature */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Temperature</h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-xs text-text-primary w-8 text-right">{temperature.toFixed(1)}</span>
        </div>
        <p className="text-[10px] text-text-secondary/60 mt-1">
          Lower = more deterministic. Higher = more creative.
        </p>
      </div>

      {/* Auto Judge */}
      <Toggle
        value={autoJudge}
        onChange={setAutoJudge}
        label="Auto-judge"
        desc="Automatically run judge after every query"
      />

      {/* Send Key */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Send Shortcut</h3>
        <div className="flex gap-1">
          {[
            { value: 'enter' as const, label: 'Enter' },
            { value: 'ctrl-enter' as const, label: `${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter` },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setSendKey(opt.value)}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] transition-colors border ${
                sendKey === opt.value
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Display Tab ──

function DisplayTab() {
  const renderMarkdown = useAppStore(s => s.renderMarkdown);
  const setRenderMarkdown = useAppStore(s => s.setRenderMarkdown);
  const showCost = useAppStore(s => s.showCost);
  const setShowCost = useAppStore(s => s.setShowCost);
  const showTokens = useAppStore(s => s.showTokens);
  const setShowTokens = useAppStore(s => s.setShowTokens);
  const autoScroll = useAppStore(s => s.autoScroll);
  const setAutoScroll = useAppStore(s => s.setAutoScroll);
  const columnLayout = useAppStore(s => s.columnLayout);
  const setColumnLayout = useAppStore(s => s.setColumnLayout);
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);

  return (
    <div className="space-y-4">
      {/* Theme */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Theme</h3>
        <div className="flex gap-1">
          {[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { if (theme !== opt.value) toggleTheme(); }}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] transition-colors border ${
                theme === opt.value
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column Layout */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Column Layout</h3>
        <div className="flex gap-1">
          {[
            { value: 'auto' as const, label: 'Auto' },
            { value: '1' as const, label: '1' },
            { value: '2' as const, label: '2' },
            { value: '3' as const, label: '3' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setColumnLayout(opt.value)}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] transition-colors border ${
                columnLayout === opt.value
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <Toggle value={renderMarkdown} onChange={setRenderMarkdown} label="Render markdown" desc="Format bold, code, etc. in responses" />
      <Toggle value={showCost} onChange={setShowCost} label="Show cost" desc="Display estimated cost per response" />
      <Toggle value={showTokens} onChange={setShowTokens} label="Show tokens" desc="Display token count per response" />
      <Toggle value={autoScroll} onChange={setAutoScroll} label="Auto-scroll" desc="Follow streaming text as it arrives" />
    </div>
  );
}

// ── Data Tab ──

function DataTab() {
  const clearAllData = useAppStore(s => s.clearAllData);
  const closeSettings = useAppStore(s => s.closeSettings);
  const autoClearDays = useAppStore(s => s.autoClearDays);
  const setAutoClearDays = useAppStore(s => s.setAutoClearDays);
  const sessions = useHistoryStore(s => s.sessions);

  const handleExport = () => {
    const data = JSON.stringify(sessions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argeon-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Auto-clear */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Auto-clear History</h3>
        <div className="flex gap-1">
          {[
            { value: null, label: 'Never' },
            { value: 7, label: '7 days' },
            { value: 30, label: '30 days' },
            { value: 90, label: '90 days' },
          ].map(opt => (
            <button
              key={opt.label}
              onClick={() => setAutoClearDays(opt.value)}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] transition-colors border ${
                autoClearDays === opt.value
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-text-secondary/60 mt-1">
          Automatically delete history entries older than this.
        </p>
      </div>

      {/* Export */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Export</h3>
        <button
          onClick={handleExport}
          disabled={sessions.length === 0}
          className="w-full px-3 py-2 text-xs bg-bg border border-border rounded text-text-primary hover:border-accent/50 transition-colors disabled:opacity-40"
        >
          Export history as JSON ({sessions.length} entries)
        </button>
      </div>

      {/* Clear all */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Danger Zone</h3>
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
        <p className="text-[10px] text-text-secondary/50 mt-1">
          Removes all API keys, history, and settings from this browser.
        </p>
      </div>
    </div>
  );
}

// ── Account Tab ──

function AccountTab() {
  const { user, isLoggedIn, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const historySyncEnabled = useAppStore(s => s.historySyncEnabled);
  const setHistorySyncEnabled = useAppStore(s => s.setHistorySyncEnabled);
  const proxyProviders = useAppStore(s => s.proxyProviders);
  const toggleProxyProvider = useAppStore(s => s.toggleProxyProvider);

  if (!isLoggedIn) {
    return (
      <div>
        <p className="text-[11px] text-text-secondary/70 mb-3 leading-snug">
          Sign in to sync your API keys, settings, and optionally query history across devices. The app works fully without an account.
        </p>
        <button
          onClick={() => setShowLogin(true)}
          className="px-4 py-2 text-xs bg-accent/10 border border-accent/30 rounded text-accent hover:bg-accent/20 transition-colors"
        >
          Sign in
        </button>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile */}
      <div className="flex items-center gap-2">
        {user?.user_metadata?.avatar_url && (
          <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-full" />
        )}
        <div>
          <p className="text-xs text-text-primary">{user?.user_metadata?.full_name || user?.email}</p>
          <p className="text-[10px] text-text-secondary">{user?.email}</p>
        </div>
      </div>

      <p className="text-[10px] text-success">API keys and preferences are syncing.</p>

      {/* Sync toggles */}
      <Toggle
        value={historySyncEnabled}
        onChange={setHistorySyncEnabled}
        label="Sync query history"
        desc="Save history to the cloud for cross-device access"
      />

      {/* Proxy toggles */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Server Proxy</h3>
        <p className="text-[10px] text-text-secondary/70 mb-2">Route queries through our server so your key never touches the browser.</p>
        {['openai', 'xai'].map(id => (
          <Toggle
            key={id}
            value={proxyProviders.has(id)}
            onChange={() => toggleProxyProvider(id)}
            label={PROVIDERS[id].name}
          />
        ))}
      </div>

      <button
        onClick={logout}
        className="text-[11px] text-text-secondary hover:text-text-primary transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

// ── Key Row ──

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
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDERS[providerId].brandColor }} />
        <span className="text-[11px] text-text-primary">{PROVIDERS[providerId].name}</span>
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
          <button onClick={() => setShowKey(v => !v)} className="hover:text-text-primary transition-colors">
            {showKey ? 'Hide' : 'Show'}
          </button>
          <span className="text-border">|</span>
          <button onClick={handleCopy} className="hover:text-text-primary transition-colors">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
