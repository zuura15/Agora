import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { PROVIDER_IDS } from '../providers/capabilities';
import type { Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

let unsubscribe: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function startSync(session: Session) {
  // Pull cloud data on login
  await pullKeys(session);
  await pullPreferences(session);

  // Subscribe to local store changes and push to cloud
  unsubscribe = useAppStore.subscribe((state, prevState) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const session = supabase.auth.getSession();
      session.then(({ data: { session } }) => {
        if (!session) return;
        // Check if keys changed
        if (state.apiKeys !== prevState.apiKeys) {
          pushKeys(state.apiKeys, session);
        }
        // Check if preferences changed
        if (
          state.selectedModels !== prevState.selectedModels ||
          state.theme !== prevState.theme ||
          state.judgeProvider !== prevState.judgeProvider
        ) {
          pushPreferences(state, session);
        }
      });
    }, 300);
  });
}

export function stopSync() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

async function pushKeys(apiKeys: Record<string, string>, session: Session) {
  for (const providerId of PROVIDER_IDS) {
    const key = apiKeys[providerId as string];
    if (key) {
      // Encrypt via Edge Function
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
    } else {
      await supabase.from('encrypted_keys')
        .delete()
        .eq('user_id', session.user.id)
        .eq('provider_id', providerId as string);
    }
  }
}

async function pullKeys(session: Session) {
  // Decrypt via Edge Function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/encrypt-keys`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) return;

  const { keys } = await response.json() as { keys: Record<string, string> };
  if (!keys) return;

  const store = useAppStore.getState();
  for (const [providerId, key] of Object.entries(keys)) {
    // Only set keys that aren't already configured locally
    if (!store.apiKeys[providerId] && key) {
      store.setApiKey(providerId, key);
    }
  }
}

async function pushPreferences(
  state: { selectedModels: Record<string, string>; theme: string; judgeProvider: string | null },
  session: Session
) {
  await supabase.from('preferences').upsert({
    user_id: session.user.id,
    selected_models: state.selectedModels,
    theme: state.theme,
    judge_provider: state.judgeProvider,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

async function pullPreferences(session: Session) {
  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (error || !data) return;

  const store = useAppStore.getState();

  if (data.selected_models) {
    const models = data.selected_models as Record<string, string>;
    for (const [providerId, model] of Object.entries(models)) {
      if (model && !store.selectedModels[providerId]) {
        store.setSelectedModel(providerId, model);
      }
    }
  }

  if (data.theme && data.theme !== store.theme) {
    store.toggleTheme();
  }

  if (data.judge_provider && !store.judgeProvider) {
    store.setJudgeProvider(data.judge_provider);
  }
}
