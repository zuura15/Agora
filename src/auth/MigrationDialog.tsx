import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useHistoryStore } from '../store/historyStore';
import { supabase } from '../lib/supabase';
import { PROVIDER_IDS } from '../providers/capabilities';
import { pushSession } from '../sync/historySyncEngine';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Props {
  onClose: () => void;
}

export function MigrationDialog({ onClose }: Props) {
  const [migrating, setMigrating] = useState(false);
  const apiKeys = useAppStore(s => s.apiKeys);
  const sessions = useHistoryStore(s => s.sessions);

  const keyCount = Object.keys(apiKeys).length;
  const sessionCount = sessions.length;

  if (keyCount === 0 && sessionCount === 0) {
    // Nothing to migrate
    onClose();
    return null;
  }

  const handleSync = async () => {
    setMigrating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Push keys via encrypt Edge Function
      for (const providerId of PROVIDER_IDS) {
        const key = apiKeys[providerId as string];
        if (key) {
          await fetch(`${SUPABASE_URL}/functions/v1/encrypt-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              provider_id: providerId,
              plaintext_key: key,
            }),
          });
        }
      }

      // Push history
      for (const s of sessions) {
        if (s.id) {
          await pushSession(session, s);
        }
      }
    } finally {
      setMigrating(false);
      localStorage.setItem('agora_migration_done', 'true');
      onClose();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('agora_migration_done', 'true');
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-sm">
          <h2 className="text-lg font-display font-bold text-text-primary mb-1">Sync your data?</h2>
          <p className="text-xs text-text-secondary mb-4">
            You have {keyCount > 0 && `${keyCount} API key${keyCount > 1 ? 's' : ''}`}
            {keyCount > 0 && sessionCount > 0 && ' and '}
            {sessionCount > 0 && `${sessionCount} history entr${sessionCount > 1 ? 'ies' : 'y'}`}
            {' '}stored locally. Would you like to sync them to your account for cross-device access?
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSync}
              disabled={migrating}
              className="w-full px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {migrating ? 'Syncing...' : 'Sync my data'}
            </button>
            <button
              onClick={handleSkip}
              disabled={migrating}
              className="w-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Keep local only
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
