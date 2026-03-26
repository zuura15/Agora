import { create } from 'zustand';
import { db, type QuerySession, type ProviderResponse } from '../lib/dexie';
import { supabase } from '../lib/supabase';
import { pushSession, pushSessionResponse, pullCloudSessions, deleteCloudSession, clearCloudHistory } from '../sync/historySyncEngine';
import { useAppStore } from './appStore';

function getAuthSession() {
  return supabase.auth.getSession().then(({ data: { session } }) => session);
}

function shouldSync() {
  return useAppStore.getState().historySyncEnabled;
}

interface HistoryState {
  sessions: QuerySession[];
  loaded: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  loadSessions: () => Promise<void>;
  addSession: (query: string, files?: string[]) => Promise<number>;
  updateSessionResponse: (sessionId: number, response: ProviderResponse) => Promise<void>;
  deleteSession: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
  getFilteredSessions: () => QuerySession[];
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  sessions: [],
  loaded: false,
  searchQuery: '',

  setSearchQuery: (q) => set({ searchQuery: q }),

  loadSessions: async () => {
    // Load local sessions first (fast)
    const localSessions = await db.sessions.orderBy('timestamp').reverse().toArray();
    set({ sessions: localSessions, loaded: true });

    // If history sync is enabled, merge cloud sessions in background
    if (shouldSync()) {
      const authSession = await getAuthSession();
      if (authSession) {
        const cloudSessions = await pullCloudSessions(authSession);
        if (cloudSessions.length > 0) {
          set(state => {
            const localIds = new Set(state.sessions.map(s => s.id));
            const newSessions = cloudSessions.filter(cs => !localIds.has(cs.id));
            if (newSessions.length === 0) return state;
            const merged = [...state.sessions, ...newSessions]
              .sort((a, b) => b.timestamp - a.timestamp);
            return { sessions: merged };
          });
        }
      }
    }
  },

  addSession: async (query, files) => {
    const session: QuerySession = {
      query,
      timestamp: Date.now(),
      responses: [],
      files,
    };
    const id = await db.sessions.add(session) as number;
    session.id = id;
    set(state => ({ sessions: [session, ...state.sessions] }));

    // Fire-and-forget cloud push
    if (shouldSync()) {
      getAuthSession().then(authSession => {
        if (authSession) pushSession(authSession, session);
      });
    }

    return id;
  },

  updateSessionResponse: async (sessionId, response) => {
    const session = await db.sessions.get(sessionId);
    if (!session) return;

    const existing = session.responses.findIndex(r => r.providerId === response.providerId);
    if (existing >= 0) {
      session.responses[existing] = response;
    } else {
      session.responses.push(response);
    }

    await db.sessions.update(sessionId, { responses: session.responses });
    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === sessionId ? { ...s, responses: [...session.responses] } : s
      ),
    }));

    // Fire-and-forget cloud push
    if (shouldSync()) {
      getAuthSession().then(authSession => {
        if (authSession) pushSessionResponse(authSession, sessionId, response);
      });
    }
  },

  deleteSession: async (id) => {
    await db.sessions.delete(id);
    set(state => ({ sessions: state.sessions.filter(s => s.id !== id) }));

    if (shouldSync()) {
      getAuthSession().then(authSession => {
        if (authSession) deleteCloudSession(authSession, id);
      });
    }
  },

  clearAll: async () => {
    await db.sessions.clear();
    set({ sessions: [] });

    if (shouldSync()) {
      getAuthSession().then(authSession => {
        if (authSession) clearCloudHistory(authSession);
      });
    }
  },

  getFilteredSessions: () => {
    const { sessions, searchQuery } = get();
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => s.query.toLowerCase().includes(q));
  },
}));
