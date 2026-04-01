import { create } from 'zustand';
import { PROVIDERS, PROVIDER_IDS } from '../providers/capabilities';
import type { AccessCode, QueryMode } from '../types/accessCode';
import { logger } from '../lib/logger';

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

  // Sync
  historySyncEnabled: boolean;
  setHistorySyncEnabled: (v: boolean) => void;
  proxyProviders: Set<string>;
  toggleProxyProvider: (id: string) => void;

  // General settings
  responseLength: 'normal' | 'brief' | 'superbrief';
  setResponseLength: (v: 'normal' | 'brief' | 'superbrief') => void;
  temperature: number;
  setTemperature: (v: number) => void;
  autoJudge: boolean;
  setAutoJudge: (v: boolean) => void;
  sendKey: 'enter' | 'ctrl-enter';
  setSendKey: (v: 'enter' | 'ctrl-enter') => void;

  // Display settings
  renderMarkdown: boolean;
  setRenderMarkdown: (v: boolean) => void;
  showCost: boolean;
  setShowCost: (v: boolean) => void;
  showTokens: boolean;
  setShowTokens: (v: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  columnLayout: 'auto' | '1' | '2' | '3';
  setColumnLayout: (v: 'auto' | '1' | '2' | '3') => void;

  // Data settings
  autoClearDays: number | null;
  setAutoClearDays: (v: number | null) => void;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // UI state
  historyOpen: boolean;
  settingsOpen: boolean;
  toggleHistory: () => void;
  toggleSettings: () => void;
  closeSettings: () => void;

  // Access code system
  queryMode: QueryMode;
  setQueryMode: (mode: QueryMode) => void;
  accessCodes: AccessCode[];
  setAccessCodes: (codes: AccessCode[]) => void;
  totalBalance: number;
  setTotalBalance: (amount: number) => void;
  dailyQueryCount: number;
  setDailyQueryCount: (count: number) => void;
  dailyQueryLimit: number;
  availableProviders: string[];
  setAvailableProviders: (ids: string[]) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  canSendAccessCodeQuery: () => { allowed: boolean; reason?: string };

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
    PROVIDER_IDS.filter(id => !!localStorage.getItem(`agora_key_${id}`)).slice(0, 3)
  ),
  selectedModels: loadModels(),
  discoveredModels: loadDiscoveredModels(),
  judgeProvider: localStorage.getItem('agora_judge') || null,
  responseLength: (localStorage.getItem('agora_response_length') as 'normal' | 'brief' | 'superbrief') || 'brief',
  temperature: parseFloat(localStorage.getItem('agora_temperature') || '0.7'),
  autoJudge: localStorage.getItem('agora_auto_judge') === 'true',
  sendKey: (localStorage.getItem('agora_send_key') as 'enter' | 'ctrl-enter') || 'enter',
  renderMarkdown: localStorage.getItem('agora_render_markdown') !== 'false',
  showCost: localStorage.getItem('agora_show_cost') !== 'false',
  showTokens: localStorage.getItem('agora_show_tokens') !== 'false',
  autoScroll: localStorage.getItem('agora_auto_scroll') !== 'false',
  columnLayout: (localStorage.getItem('agora_column_layout') as 'auto' | '1' | '2' | '3') || 'auto',
  autoClearDays: localStorage.getItem('agora_auto_clear_days') ? parseInt(localStorage.getItem('agora_auto_clear_days')!) : null,
  historySyncEnabled: localStorage.getItem('agora_history_sync') === 'true',
  proxyProviders: new Set(JSON.parse(localStorage.getItem('agora_proxy_providers') || '[]')),
  theme: (localStorage.getItem('agora_theme') as 'dark' | 'light') || 'dark',
  historyOpen: false,
  settingsOpen: false,

  // Access code system
  queryMode: (localStorage.getItem('agora_query_mode') as QueryMode) || 'byok',
  accessCodes: [],
  totalBalance: 0,
  dailyQueryCount: 0,
  dailyQueryLimit: 20,
  availableProviders: [],
  isAdmin: false,

  setQueryMode: (mode) => {
    logger.access.info('setQueryMode', { mode });
    localStorage.setItem('agora_query_mode', mode);
    const state = get();
    const updates: Partial<AppState> = { queryMode: mode };

    // Auto-switch to brief if entering access-code mode with normal response length
    if (mode === 'access-code' && state.responseLength === 'normal') {
      logger.access.info('setQueryMode — auto-switching to brief');
      localStorage.setItem('agora_response_length', 'brief');
      updates.responseLength = 'brief';
    }

    // Auto-populate activeProviders from availableProviders when entering access-code mode
    if (mode === 'access-code' && state.availableProviders.length > 0) {
      const newActive = new Set(state.availableProviders.slice(0, 3));
      logger.access.info('setQueryMode — auto-activating providers', { providers: Array.from(newActive) });
      updates.activeProviders = newActive;
    }

    set(updates);
  },

  setAccessCodes: (codes) => {
    const activeCodes = codes.filter(c => !c.blocked && c.remaining_credit > 0);
    const totalBalance = activeCodes.reduce((sum, c) => sum + Number(c.remaining_credit), 0);
    logger.access.info('setAccessCodes', { total: codes.length, active: activeCodes.length, totalBalance });
    set({ accessCodes: codes, totalBalance });
  },

  setTotalBalance: (amount) => set({ totalBalance: amount }),

  setDailyQueryCount: (count) => set({ dailyQueryCount: count }),

  setAvailableProviders: (ids) => {
    logger.access.info('setAvailableProviders', { ids });
    const state = get();
    const updates: Partial<AppState> = { availableProviders: ids };
    // If in access-code mode and no active providers set yet, auto-activate
    if (state.queryMode === 'access-code' && (state.activeProviders.size === 0 || !Array.from(state.activeProviders).some(p => ids.includes(p)))) {
      updates.activeProviders = new Set(ids.slice(0, 3));
      logger.access.info('setAvailableProviders — auto-activating', { providers: ids.slice(0, 3) });
    }
    set(updates);
  },

  setIsAdmin: (v) => set({ isAdmin: v }),

  canSendAccessCodeQuery: () => {
    const { totalBalance, dailyQueryCount, dailyQueryLimit } = get();
    if (totalBalance <= 0) return { allowed: false, reason: 'Your access credit is depleted' };
    if (dailyQueryCount >= dailyQueryLimit) return { allowed: false, reason: 'Daily query limit reached. Resets at midnight UTC.' };
    return { allowed: true };
  },

  setApiKey: (providerId, key) => {
    localStorage.setItem(`agora_key_${providerId}`, key);
    set(state => {
      const apiKeys = { ...state.apiKeys, [providerId]: key };
      const activeProviders = new Set(state.activeProviders);
      if (activeProviders.size < 3) {
        activeProviders.add(providerId);
      }
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
      } else if ((state.apiKeys[providerId] || (state.queryMode === 'access-code' && state.availableProviders.includes(providerId))) && activeProviders.size < 3) {
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

  setResponseLength: (v) => {
    localStorage.setItem('agora_response_length', v);
    set({ responseLength: v });
  },

  setTemperature: (v) => {
    localStorage.setItem('agora_temperature', String(v));
    set({ temperature: v });
  },

  setAutoJudge: (v) => {
    localStorage.setItem('agora_auto_judge', String(v));
    set({ autoJudge: v });
  },

  setSendKey: (v) => {
    localStorage.setItem('agora_send_key', v);
    set({ sendKey: v });
  },

  setRenderMarkdown: (v) => {
    localStorage.setItem('agora_render_markdown', String(v));
    set({ renderMarkdown: v });
  },

  setShowCost: (v) => {
    localStorage.setItem('agora_show_cost', String(v));
    set({ showCost: v });
  },

  setShowTokens: (v) => {
    localStorage.setItem('agora_show_tokens', String(v));
    set({ showTokens: v });
  },

  setAutoScroll: (v) => {
    localStorage.setItem('agora_auto_scroll', String(v));
    set({ autoScroll: v });
  },

  setColumnLayout: (v) => {
    localStorage.setItem('agora_column_layout', v);
    set({ columnLayout: v });
  },

  setAutoClearDays: (v) => {
    if (v !== null) {
      localStorage.setItem('agora_auto_clear_days', String(v));
    } else {
      localStorage.removeItem('agora_auto_clear_days');
    }
    set({ autoClearDays: v });
  },

  setHistorySyncEnabled: (v) => {
    localStorage.setItem('agora_history_sync', String(v));
    set({ historySyncEnabled: v });
  },

  toggleProxyProvider: (id) => {
    set(state => {
      const proxyProviders = new Set(state.proxyProviders);
      if (proxyProviders.has(id)) {
        proxyProviders.delete(id);
      } else {
        proxyProviders.add(id);
      }
      localStorage.setItem('agora_proxy_providers', JSON.stringify([...proxyProviders]));
      return { proxyProviders };
    });
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
  getConfiguredProviders: () => {
    const state = get();
    if (state.queryMode === 'access-code' && state.availableProviders.length > 0) {
      // In access-code mode, show available providers (from server) instead of BYOK keys
      return state.availableProviders;
    }
    return Object.keys(state.apiKeys);
  },

  clearAllData: () => {
    for (const id of PROVIDER_IDS) {
      localStorage.removeItem(`agora_key_${id}`);
      localStorage.removeItem(`agora_model_${id}`);
      localStorage.removeItem(`agora_discovered_${id}`);
    }
    // Clear IndexedDB
    // Clear IndexedDB via Dexie
    indexedDB.deleteDatabase('AgoraDB');
    localStorage.removeItem('agora_query_mode');
    set({
      apiKeys: {},
      activeProviders: new Set(),
      selectedModels: loadModels(),
      discoveredModels: {},
      historyOpen: false,
      settingsOpen: false,
      queryMode: 'byok',
      accessCodes: [],
      totalBalance: 0,
      dailyQueryCount: 0,
      availableProviders: [],
      isAdmin: false,
    });
  },
}));
