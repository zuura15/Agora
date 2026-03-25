import { create } from 'zustand';
import { PROVIDERS, PROVIDER_IDS } from '../providers/capabilities';

interface AppState {
  // API keys stored in localStorage
  apiKeys: Record<string, string>;
  setApiKey: (providerId: string, key: string) => void;
  removeApiKey: (providerId: string) => void;

  // Active providers for current query (toggled on/off)
  activeProviders: Set<string>;
  toggleProvider: (providerId: string) => void;
  setActiveProviders: (ids: Set<string>) => void;

  // Selected models per provider
  selectedModels: Record<string, string>;
  setSelectedModel: (providerId: string, model: string) => void;

  // Discovered models per provider (cached)
  discoveredModels: Record<string, string[]>;
  setDiscoveredModels: (providerId: string, models: string[]) => void;

  // Judge mode
  judgeProvider: string | null;
  setJudgeProvider: (id: string | null) => void;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // UI state
  historyOpen: boolean;
  settingsOpen: boolean;
  toggleHistory: () => void;
  toggleSettings: () => void;
  closeSettings: () => void;

  // Check if any provider is configured
  hasAnyKey: () => boolean;
  getConfiguredProviders: () => string[];

  // Clear all data
  clearAllData: () => void;
}

function loadKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const id of PROVIDER_IDS) {
    const key = localStorage.getItem(`agora_key_${id}`);
    if (key) keys[id] = key;
  }
  return keys;
}

function loadModels(): Record<string, string> {
  const models: Record<string, string> = {};
  for (const id of PROVIDER_IDS) {
    const model = localStorage.getItem(`agora_model_${id}`);
    if (model) {
      models[id] = model;
    } else {
      models[id] = PROVIDERS[id].defaultModels[0];
    }
  }
  return models;
}

function loadDiscoveredModels(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const id of PROVIDER_IDS) {
    const cached = localStorage.getItem(`agora_discovered_${id}`);
    if (cached) {
      try {
        const { models, timestamp } = JSON.parse(cached);
        // 24h TTL
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          result[id] = models;
        }
      } catch {
        // ignore
      }
    }
  }
  return result;
}

export const useAppStore = create<AppState>((set, get) => ({
  apiKeys: loadKeys(),
  activeProviders: new Set(
    PROVIDER_IDS.filter(id => !!localStorage.getItem(`agora_key_${id}`))
  ),
  selectedModels: loadModels(),
  discoveredModels: loadDiscoveredModels(),
  judgeProvider: localStorage.getItem('agora_judge') || null,
  theme: (localStorage.getItem('agora_theme') as 'dark' | 'light') || 'dark',
  historyOpen: false,
  settingsOpen: false,

  setApiKey: (providerId, key) => {
    localStorage.setItem(`agora_key_${providerId}`, key);
    set(state => {
      const apiKeys = { ...state.apiKeys, [providerId]: key };
      const activeProviders = new Set(state.activeProviders);
      activeProviders.add(providerId);
      return { apiKeys, activeProviders };
    });
  },

  removeApiKey: (providerId) => {
    localStorage.removeItem(`agora_key_${providerId}`);
    set(state => {
      const apiKeys = { ...state.apiKeys };
      delete apiKeys[providerId];
      const activeProviders = new Set(state.activeProviders);
      activeProviders.delete(providerId);
      return { apiKeys, activeProviders };
    });
  },

  toggleProvider: (providerId) => {
    set(state => {
      const activeProviders = new Set(state.activeProviders);
      if (activeProviders.has(providerId)) {
        activeProviders.delete(providerId);
        // If this was the judge, clear it
        const judgeUpdate = state.judgeProvider === providerId ? { judgeProvider: null } : {};
        if (state.judgeProvider === providerId) localStorage.removeItem('agora_judge');
        return { activeProviders, ...judgeUpdate };
      } else if (state.apiKeys[providerId] && activeProviders.size < 3) {
        activeProviders.add(providerId);
      }
      return { activeProviders };
    });
  },

  setActiveProviders: (ids) => set({ activeProviders: ids }),

  setSelectedModel: (providerId, model) => {
    localStorage.setItem(`agora_model_${providerId}`, model);
    set(state => ({
      selectedModels: { ...state.selectedModels, [providerId]: model },
    }));
  },

  setDiscoveredModels: (providerId, models) => {
    localStorage.setItem(`agora_discovered_${providerId}`, JSON.stringify({
      models,
      timestamp: Date.now(),
    }));
    set(state => ({
      discoveredModels: { ...state.discoveredModels, [providerId]: models },
    }));
  },

  setJudgeProvider: (id) => {
    if (id) {
      localStorage.setItem('agora_judge', id);
    } else {
      localStorage.removeItem('agora_judge');
    }
    set({ judgeProvider: id });
  },

  toggleTheme: () => {
    set(state => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('agora_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    });
  },

  toggleHistory: () => set(state => ({ historyOpen: !state.historyOpen })),
  toggleSettings: () => set(state => ({ settingsOpen: !state.settingsOpen })),
  closeSettings: () => set({ settingsOpen: false }),

  hasAnyKey: () => Object.keys(get().apiKeys).length > 0,
  getConfiguredProviders: () => Object.keys(get().apiKeys),

  clearAllData: () => {
    for (const id of PROVIDER_IDS) {
      localStorage.removeItem(`agora_key_${id}`);
      localStorage.removeItem(`agora_model_${id}`);
      localStorage.removeItem(`agora_discovered_${id}`);
    }
    // Clear IndexedDB
    // Clear IndexedDB via Dexie
    indexedDB.deleteDatabase('AgoraDB');
    set({
      apiKeys: {},
      activeProviders: new Set(),
      selectedModels: loadModels(),
      discoveredModels: {},
      historyOpen: false,
      settingsOpen: false,
    });
  },
}));
