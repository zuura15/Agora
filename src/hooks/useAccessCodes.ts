import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthContext } from '../auth/AuthProvider';
import { fetchAccessStatus, redeemCode, checkAdmin } from '../lib/accessCodeService';
import { logger } from '../lib/logger';

export function useAccessCodes() {
  const { session, isLoggedIn } = useAuthContext();
  const queryMode = useAppStore(s => s.queryMode);
  const setAccessCodes = useAppStore(s => s.setAccessCodes);
  const setDailyQueryCount = useAppStore(s => s.setDailyQueryCount);
  const setAvailableProviders = useAppStore(s => s.setAvailableProviders);
  const setIsAdmin = useAppStore(s => s.setIsAdmin);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminChecked = useRef(false);

  const refresh = useCallback(async () => {
    if (!session) {
      logger.access.info('useAccessCodes.refresh — skipped, no session');
      return;
    }
    logger.access.info('useAccessCodes.refresh — fetching status');
    try {
      const status = await fetchAccessStatus(session);
      setAccessCodes(status.accessCodes);
      setDailyQueryCount(status.dailyQueryCount);
      if (status.availableProviders.length > 0) {
        setAvailableProviders(status.availableProviders);
      }
      logger.access.info('useAccessCodes.refresh — done', {
        codes: status.accessCodes.length,
        balance: status.totalBalance,
        providers: status.availableProviders,
      });
    } catch (err) {
      logger.access.error('useAccessCodes.refresh — failed', err);
    }
  }, [session, setAccessCodes, setDailyQueryCount, setAvailableProviders]);

  // Load on login
  useEffect(() => {
    if (!isLoggedIn || !session) {
      logger.access.info('useAccessCodes — not logged in, skipping init');
      return;
    }
    logger.access.info('useAccessCodes — logged in, initializing', { email: session.user?.email });
    refresh();
    if (!adminChecked.current) {
      adminChecked.current = true;
      checkAdmin(session).then(isAdmin => {
        logger.admin.info('useAccessCodes — isAdmin', { isAdmin });
        setIsAdmin(isAdmin);
      });
    }
  }, [isLoggedIn, session, refresh, setIsAdmin]);

  // Poll every 60s when in access-code mode
  useEffect(() => {
    if (queryMode === 'access-code' && session) {
      logger.access.info('useAccessCodes — starting 60s poll');
      pollRef.current = setInterval(refresh, 60000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    if (pollRef.current) {
      logger.access.info('useAccessCodes — stopping poll');
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [queryMode, session, refresh]);

  const redeem = useCallback(async (code: string) => {
    if (!session) {
      logger.access.error('useAccessCodes.redeem — no session');
      return { success: false, error: 'Not logged in' };
    }
    logger.access.info('useAccessCodes.redeem — attempting', { code: code.substring(0, 10) + '...' });
    const result = await redeemCode(session, code);
    if (result.success) {
      logger.access.info('useAccessCodes.redeem — success, refreshing');
      await refresh();
    } else {
      logger.access.warn('useAccessCodes.redeem — failed', result);
    }
    return result;
  }, [session, refresh]);

  return { refresh, redeem };
}
