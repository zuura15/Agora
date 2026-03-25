import { useQueryHistory } from '../hooks/useQueryHistory';
import { useAppStore } from '../store/appStore';
import type { QuerySession } from '../lib/dexie';

interface Props {
  onLoadSession: (session: QuerySession) => void;
}

export function HistorySidebar({ onLoadSession }: Props) {
  const historyOpen = useAppStore(s => s.historyOpen);
  const toggleHistory = useAppStore(s => s.toggleHistory);
  const { sessions, searchQuery, setSearchQuery, deleteSession, clearAll } = useQueryHistory();

  if (!historyOpen) return null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-72 shrink-0 border-r border-border bg-surface/50 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-primary">History</span>
        <button onClick={toggleHistory} className="text-text-secondary hover:text-text-primary text-xs">
          Close
        </button>
      </div>

      <div className="px-3 py-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search history..."
          className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="text-xs text-text-secondary/60 text-center py-8">No history yet</p>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className="group px-3 py-2 hover:bg-bg/50 cursor-pointer border-b border-border/30 transition-colors"
              onClick={() => onLoadSession(session)}
            >
              <p className="text-[10px] text-text-secondary">{formatTime(session.timestamp)}</p>
              <p className="text-xs text-text-primary truncate mt-0.5">{session.query}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-text-secondary/60">
                  {session.responses.length} response{session.responses.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (session.id != null) deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-[10px] text-error/60 hover:text-error transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {sessions.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={() => { if (confirm('Clear all history?')) clearAll(); }}
            className="w-full text-[10px] text-error/60 hover:text-error transition-colors"
          >
            Clear All History
          </button>
        </div>
      )}
    </div>
  );
}
