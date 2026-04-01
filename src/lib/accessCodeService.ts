import { supabase } from './supabase';
import { logger } from './logger';
import type { AccessCode, ReservationResult, AccessCodeStatus } from '../types/accessCode';
import type { Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callFunction(_session: Session, functionName: string, body: unknown) {
  logger.access.info(`callFunction → ${functionName}`, body);

  const { data: { session: freshSession } } = await supabase.auth.getSession();
  if (!freshSession) {
    logger.access.error(`callFunction → ${functionName} — no session`);
    throw { status: 401, error: 'Not authenticated' };
  }

  logger.access.info(`callFunction → ${functionName} — token: ${freshSession.access_token.substring(0, 20)}...`);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${freshSession.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok) {
    logger.access.error(`callFunction → ${functionName} — HTTP ${res.status}`, data);
    throw { status: res.status, ...data };
  }

  logger.access.info(`callFunction → ${functionName} — OK`, data);
  return data;
}

export async function fetchUserAccessCodes(session: Session): Promise<AccessCode[]> {
  logger.access.info('fetchUserAccessCodes');
  const { data: { user } } = await supabase.auth.getUser(session.access_token);
  if (!user) {
    logger.access.warn('fetchUserAccessCodes — no user from getUser');
    return [];
  }
  logger.access.info('fetchUserAccessCodes — user', { id: user.id, email: user.email });
  const { data, error } = await supabase
    .from('access_codes')
    .select('*')
    .eq('redeemed_by_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.access.error('fetchUserAccessCodes — query error', error);
    throw error;
  }
  logger.access.info('fetchUserAccessCodes — found', { count: data?.length || 0 });
  return data || [];
}

export async function fetchAccessStatus(session: Session): Promise<AccessCodeStatus> {
  logger.access.info('fetchAccessStatus — begin');
  const codes = await fetchUserAccessCodes(session);
  const activeCodes = codes.filter(c => !c.blocked && c.remaining_credit > 0);
  const totalBalance = activeCodes.reduce((sum, c) => sum + Number(c.remaining_credit), 0);

  // Use PST date to match server-side daily_usage partitioning
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).toISOString().slice(0, 10);
  const { data: dailyData, error: dailyError } = await supabase
    .from('daily_usage')
    .select('query_count')
    .eq('usage_date', today)
    .maybeSingle();

  if (dailyError) {
    logger.access.warn('fetchAccessStatus — daily_usage query error', dailyError);
  }

  let availableProviders: string[] = [];
  try {
    const res = await callFunction(session, 'reserve-query', { check_only: true });
    availableProviders = res.available_providers || [];
  } catch (err) {
    logger.access.warn('fetchAccessStatus — reserve-query check_only failed (non-fatal)', err);
  }

  const status = {
    accessCodes: codes,
    totalBalance,
    dailyQueryCount: dailyData?.query_count || 0,
    availableProviders,
  };
  logger.access.info('fetchAccessStatus — result', { codes: codes.length, totalBalance, dailyQueryCount: status.dailyQueryCount, providers: availableProviders });
  return status;
}

export async function redeemCode(session: Session, code: string): Promise<{ success: boolean; code?: AccessCode; error?: string; reason?: string }> {
  logger.access.info('redeemCode', { code: code.substring(0, 10) + '...' });
  try {
    const data = await callFunction(session, 'redeem-code', { code });
    logger.access.info('redeemCode — success', data.code);
    return { success: true, code: data.code };
  } catch (err: any) {
    logger.access.error('redeemCode — failed', err);
    return { success: false, error: err.error || 'Failed to redeem', reason: err.reason };
  }
}

export async function reserveQuery(session: Session): Promise<ReservationResult> {
  logger.access.info('reserveQuery — begin');
  const result = await callFunction(session, 'reserve-query', {});
  logger.access.info('reserveQuery — result', result);
  return result;
}

export async function checkAdmin(session: Session): Promise<boolean> {
  logger.admin.info('checkAdmin — begin');
  try {
    const data = await callFunction(session, 'admin-codes', { action: 'check_admin' });
    logger.admin.info('checkAdmin — result', data);
    return data.is_admin === true;
  } catch (err) {
    logger.admin.error('checkAdmin — failed', err);
    return false;
  }
}

export async function adminListCodes(session: Session) {
  logger.admin.info('adminListCodes');
  return callFunction(session, 'admin-codes', { action: 'list' });
}

export async function adminGenerateCode(session: Session, initialCredit: number) {
  logger.admin.info('adminGenerateCode', { initialCredit });
  return callFunction(session, 'admin-codes', { action: 'generate', initial_credit: initialCredit });
}

export async function adminBlockCode(session: Session, codeId: string) {
  logger.admin.info('adminBlockCode', { codeId });
  return callFunction(session, 'admin-codes', { action: 'block', code_id: codeId });
}

export async function adminUnblockCode(session: Session, codeId: string) {
  logger.admin.info('adminUnblockCode', { codeId });
  return callFunction(session, 'admin-codes', { action: 'unblock', code_id: codeId });
}

export async function adminUsageStats(session: Session) {
  logger.admin.info('adminUsageStats');
  return callFunction(session, 'admin-codes', { action: 'usage' });
}
