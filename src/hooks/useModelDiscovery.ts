import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { PROVIDERS } from '../providers/capabilities';
import { getDiscoverModelsFn } from '../providers/index';

export function useModelDiscovery() {
  const apiKeys = useAppStore(s => s.apiKeys);
  const discoveredModels = useAppStore(s => s.discoveredModels);
  const setDiscoveredModels = useAppStore(s => s.setDiscoveredModels);

  useEffect(() => {
    // Fire discovery in background for each configured provider
    for (const [providerId, key] of Object.entries(apiKeys)) {
      if (!key) continue;
      if (!PROVIDERS[providerId]?.supportsModelDiscovery) continue;

      // Skip if we have a fresh cache
      if (discoveredModels[providerId]?.length) continue;

      const discoverFn = getDiscoverModelsFn(providerId);
      discoverFn(key).then(models => {
        if (models.length > 0) {
          setDiscoveredModels(providerId, models);
        }
      }).catch(() => {
        // Fail silently — defaults are used
      });
    }
  }, [apiKeys]); // Re-run when keys change

  return {
    getModelsForProvider: (providerId: string): string[] => {
      const discovered = discoveredModels[providerId];
      const defaults = PROVIDERS[providerId]?.defaultModels || [];
      if (discovered?.length) {
        // Merge: defaults first, then discovered (deduped)
        const all = new Set([...defaults, ...discovered]);
        return Array.from(all);
      }
      return defaults;
    },
  };
}
