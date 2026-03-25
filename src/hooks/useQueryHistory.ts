import { useEffect } from 'react';
import { useHistoryStore } from '../store/historyStore';

export function useQueryHistory() {
  const { sessions, loaded, loadSessions, searchQuery, setSearchQuery, deleteSession, clearAll, getFilteredSessions } = useHistoryStore();

  useEffect(() => {
    if (!loaded) {
      loadSessions();
    }
  }, [loaded, loadSessions]);

  return {
    sessions: getFilteredSessions(),
    allSessions: sessions,
    loaded,
    searchQuery,
    setSearchQuery,
    deleteSession,
    clearAll,
  };
}
