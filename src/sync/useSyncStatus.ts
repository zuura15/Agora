import { useAuthContext } from '../auth/AuthProvider';
import { useAppStore } from '../store/appStore';

export function useSyncStatus() {
  const { isLoggedIn } = useAuthContext();
  const historySyncEnabled = useAppStore(s => s.historySyncEnabled);
  const proxyProviders = useAppStore(s => s.proxyProviders);

  return {
    isLoggedIn,
    keySyncActive: isLoggedIn,
    historySyncActive: isLoggedIn && historySyncEnabled,
    proxyActive: isLoggedIn && proxyProviders.size > 0,
    proxyProviders: isLoggedIn ? proxyProviders : new Set<string>(),
  };
}
