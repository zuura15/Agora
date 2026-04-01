import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useProviders, type ResponseState } from '../hooks/useProviders';
import { useModelDiscovery } from '../hooks/useModelDiscovery';
import { useHistoryStore } from '../store/historyStore';
import { PROVIDERS } from '../providers/capabilities';
import { db } from '../lib/dexie';
import { PrivacyBanner } from '../components/PrivacyBanner';
import { QueryInput } from '../components/QueryInput';
import { ResponseColumn } from '../components/ResponseColumn';
import { HistorySidebar } from '../components/HistorySidebar';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { ModeSelector } from '../components/ModeSelector';
import { ZeroBalanceBanner } from '../components/ZeroBalanceBanner';
import { UserMenu } from '../auth/UserMenu';
import { useAuthContext } from '../auth/AuthProvider';
import { useAccessCodes } from '../hooks/useAccessCodes';
import type { NormalizedFile } from '../lib/fileUtils';
import type { QuerySession } from '../lib/dexie';

export function Home() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const hasAnyKey = Object.keys(useAppStore(s => s.apiKeys)).length > 0;
  const toggleHistory = useAppStore(s => s.toggleHistory);
  const toggleSettings = useAppStore(s => s.toggleSettings);
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  const activeProviders = useAppStore(s => s.activeProviders);
  const apiKeys = useAppStore(s => s.apiKeys);

  const {
    conversation, isQuerying,
    followUpMode, setFollowUpMode,
    followUpProviders, setFollowUpProviders,
    sendQuery, retryProvider, cancelAll, clearConversation,
  } = useProviders();
  const [lastQuery, setLastQuery] = useState('');
  const [lastFiles, setLastFiles] = useState<NormalizedFile[]>([]);
  const [loadedSession, setLoadedSession] = useState<Record<string, ResponseState> | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);

  // Initialize model discovery
  useModelDiscovery();

  // Initialize access codes
  useAccessCodes();
  const accessCodesArr = useAppStore(s => s.accessCodes);
  const queryMode = useAppStore(s => s.queryMode);
  const setQueryMode = useAppStore(s => s.setQueryMode);
  const hasActiveCodes = accessCodesArr.some(c => !c.blocked && c.remaining_credit > 0);

  // Redirect to setup if no keys AND no access codes
  const { isLoggedIn, isLoading: authLoading } = useAuthContext();
  const [syncWaited, setSyncWaited] = useState(false);

  // Give cloud sync 2 seconds to pull keys/codes after login
  useEffect(() => {
    if (!isLoggedIn) { setSyncWaited(false); return; }
    const timer = setTimeout(() => setSyncWaited(true), 2000);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn && !syncWaited) return; // Still waiting for cloud sync
    if (!hasAnyKey && !hasActiveCodes) navigate('/setup');
  }, [hasAnyKey, hasActiveCodes, navigate, authLoading, isLoggedIn, syncWaited]);

  // Auto-switch to access-code mode if user has codes but no BYOK keys
  useEffect(() => {
    if (hasActiveCodes && !hasAnyKey && queryMode === 'byok') {
      setQueryMode('access-code');
    }
  }, [hasActiveCodes, hasAnyKey, queryMode, setQueryMode]);

  // Load session from URL param
  useEffect(() => {
    if (!sessionId) return;
    const id = parseInt(sessionId, 10);
    if (isNaN(id)) return;
    db.sessions.get(id).then(session => {
      if (session) {
        loadSessionData(session);
        setCurrentSessionId(id);
      } else {
        navigate('/', { replace: true });
      }
    });
  }, [sessionId]);

  const loadSessionData = useCallback((session: QuerySession) => {
    const loaded: Record<string, ResponseState> = {};
    for (const r of session.responses) {
      loaded[r.providerId] = {
        providerId: r.providerId,
        model: r.model,
        text: r.text,
        streaming: false,
        error: r.error || null,
        startTime: 0,
        elapsedMs: r.elapsedMs,
        estimatedTokens: r.estimatedTokens,
        usage: null,
        costUsd: null,
      };
    }
    setLoadedSession(loaded);
    setLastQuery(session.query);
  }, []);

  const handleSend = useCallback((query: string, files: NormalizedFile[]) => {
    setLastQuery(query);
    setLastFiles(files);
    setLoadedSession(null);
    setCurrentSessionId(null);
    sendQuery(query, files);
  }, [sendQuery]);

  // Update URL when a new session is created in history
  const sessions = useHistoryStore(s => s.sessions);
  useEffect(() => {
    if (isQuerying || loadedSession) return;
    // Find the most recent session that matches the last query
    const latest = sessions.find(s => s.query === lastQuery && s.responses.length > 0);
    if (latest?.id && latest.id !== currentSessionId) {
      setCurrentSessionId(latest.id);
      navigate(`/s/${latest.id}`, { replace: true });
    }
  }, [sessions, isQuerying, lastQuery, loadedSession, currentSessionId, navigate]);

  const handleRetry = useCallback((providerId: string) => {
    if (lastQuery) {
      retryProvider(providerId, lastQuery, lastFiles);
    }
  }, [lastQuery, lastFiles, retryProvider]);

  const handleLoadSession = useCallback((session: QuerySession) => {
    loadSessionData(session);
    setCurrentSessionId(session.id || null);
    if (session.id) {
      navigate(`/s/${session.id}`, { replace: true });
    }
  }, [loadSessionData, navigate]);

  // For column layout calculation
  const latestResponses = conversation.length > 0
    ? Object.values(conversation[conversation.length - 1].responses).filter(r => r.providerId !== '__judge')
    : [];

  // Check for PDF warnings
  const pdfWarnings = lastFiles.some(f => f.type === 'pdf')
    ? Array.from(activeProviders).filter(id => apiKeys[id] && !PROVIDERS[id]?.supportsPdfInput)
    : [];

  const columnLayout = useAppStore(s => s.columnLayout);

  // Responsive column count
  const getColumnClass = () => {
    if (columnLayout !== 'auto') {
      const cols = parseInt(columnLayout);
      if (cols === 1) return 'grid-cols-1';
      if (cols === 2) return 'grid-cols-1 md:grid-cols-2';
      if (cols === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
    const count = latestResponses.length;
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
  };

  return (
    <div className="h-screen flex flex-col">
      <PrivacyBanner />
      <ZeroBalanceBanner />
      {!isLoggedIn && hasAnyKey && (
        <div className="flex items-center justify-center px-4 h-8 text-xs text-text-secondary bg-surface/80 border-b border-border shrink-0">
          Using your own keys works even when not signed in. But your queries won't be synced.
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <h1 className="text-lg font-display font-bold text-text-primary">Argeon</h1>
        {isLoggedIn && <ModeSelector />}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="text-text-secondary hover:text-text-primary transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            onClick={toggleHistory}
            className="text-text-secondary hover:text-text-primary transition-colors"
            title="History"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          <button
            onClick={toggleSettings}
            className="text-text-secondary hover:text-text-primary transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <UserMenu />
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <HistorySidebar onLoadSession={handleLoadSession} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <QueryInput
            onSend={handleSend}
            isQuerying={isQuerying}
            onCancel={cancelAll}
            followUpMode={followUpMode}
            onToggleFollowUp={setFollowUpMode}
            followUpProviders={followUpProviders}
            onSetFollowUpProviders={setFollowUpProviders}
            hasConversation={conversation.length > 0}
            onClearConversation={clearConversation}
          />

          {/* PDF warnings */}
          {pdfWarnings.length > 0 && (
            <div className="px-4 py-1.5">
              {pdfWarnings.map(id => (
                <div key={id} className="text-[11px] text-error/70 mb-1">
                  {'\u26A0\uFE0F'} {PROVIDERS[id].name} doesn't support PDF input — text query only
                </div>
              ))}
            </div>
          )}

          {/* Response area */}
          <div className="flex-1 overflow-y-auto p-4">
            {conversation.length > 0 ? (
              <div className="flex flex-col gap-6">
                {conversation.map((entry, entryIdx) => {
                  const entryResponses = Object.values(entry.responses);
                  const entryJudge = entryResponses.find(r => r.providerId === '__judge');
                  const entryList = entryResponses.filter(r => r.providerId !== '__judge');
                  return (
                    <div key={entryIdx}>
                      {/* Query label */}
                      <div className="px-1 pb-2">
                        <p className="text-xs text-text-secondary mb-0.5">
                          {entry.isFollowUp ? 'Follow-up:' : 'You asked:'}
                        </p>
                        <p className="text-sm text-text-primary leading-relaxed">{entry.query}</p>
                      </div>
                      {/* Response columns */}
                      <div className={`grid ${getColumnClass()} gap-4`}>
                        {entryList.map((r, i) => (
                          <ResponseColumn
                            key={r.providerId}
                            response={r}
                            index={i}
                            query={entry.query}
                            onRetry={handleRetry}
                          />
                        ))}
                      </div>
                      {entryJudge && (
                        <div className="mt-4">
                          <ResponseColumn
                            response={entryJudge}
                            index={entryList.length}
                            onRetry={() => {}}
                          />
                        </div>
                      )}
                      {/* Separator between conversation turns */}
                      {entryIdx < conversation.length - 1 && (
                        <div className="border-t border-border/30 mt-4" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>

      <SettingsDrawer />
    </div>
  );
}

function EmptyState() {
  const configuredProviders = useAppStore(s => s.getConfiguredProviders)();

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="gradient-mesh rounded-2xl p-12 text-center">
        <h2 className="text-xl font-display font-bold text-text-primary mb-2">
          One question. Many minds.
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          Type a question above to get responses from all your configured providers.
        </p>
        <div className="flex items-center justify-center gap-3">
          {configuredProviders.map(id => (
            <span
              key={id}
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: PROVIDERS[id].brandColor,
                boxShadow: `0 0 12px ${PROVIDERS[id].brandColor}40`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
