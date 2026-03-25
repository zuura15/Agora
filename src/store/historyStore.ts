import { create } from 'zustand';
import { db, type QuerySession, type ProviderResponse } from '../lib/dexie';

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
    const sessions = await db.sessions.orderBy('timestamp').reverse().toArray();
    set({ sessions, loaded: true });
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
  },

  deleteSession: async (id) => {
    await db.sessions.delete(id);
    set(state => ({ sessions: state.sessions.filter(s => s.id !== id) }));
  },

  clearAll: async () => {
    await db.sessions.clear();
    set({ sessions: [] });
  },

  getFilteredSessions: () => {
    const { sessions, searchQuery } = get();
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => s.query.toLowerCase().includes(q));
  },
}));
