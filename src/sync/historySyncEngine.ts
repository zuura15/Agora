import { supabase } from '../lib/supabase';
import type { QuerySession, ProviderResponse } from '../lib/dexie';
import type { Session } from '@supabase/supabase-js';

function getDeviceId(): string {
  let deviceId = localStorage.getItem('agora_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('agora_device_id', deviceId);
  }
  return deviceId;
}

export async function pushSession(session: Session, querySession: QuerySession) {
  if (!querySession.id) return;

  const deviceId = getDeviceId();

  await supabase.from('synced_history').upsert({
    user_id: session.user.id,
    local_id: querySession.id,
    device_id: deviceId,
    query: querySession.query,
    timestamp: querySession.timestamp,
    responses: querySession.responses,
    files: querySession.files || [],
  }, { onConflict: 'user_id,device_id,local_id' });
}

export async function pushSessionResponse(
  session: Session,
  sessionId: number,
  response: ProviderResponse
) {
  const deviceId = getDeviceId();

  // Fetch existing cloud session to append response
  const { data } = await supabase
    .from('synced_history')
    .select('responses')
    .eq('user_id', session.user.id)
    .eq('device_id', deviceId)
    .eq('local_id', sessionId)
    .single();

  if (!data) return;

  const responses = (data.responses as ProviderResponse[]) || [];
  const existing = responses.findIndex(r => r.providerId === response.providerId);
  if (existing >= 0) {
    responses[existing] = response;
  } else {
    responses.push(response);
  }

  await supabase
    .from('synced_history')
    .update({ responses })
    .eq('user_id', session.user.id)
    .eq('device_id', deviceId)
    .eq('local_id', sessionId);
}

export async function pullCloudSessions(session: Session): Promise<QuerySession[]> {
  const { data, error } = await supabase
    .from('synced_history')
    .select('*')
    .eq('user_id', session.user.id)
    .order('timestamp', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const deviceId = getDeviceId();

  return data
    .filter(row => row.device_id !== deviceId) // Exclude current device (already in local DB)
    .map(row => ({
      id: row.local_id,
      query: row.query,
      timestamp: row.timestamp,
      responses: row.responses as ProviderResponse[],
      files: row.files || [],
    }));
}

export async function deleteCloudSession(session: Session, localId: number) {
  const deviceId = getDeviceId();
  await supabase
    .from('synced_history')
    .delete()
    .eq('user_id', session.user.id)
    .eq('device_id', deviceId)
    .eq('local_id', localId);
}

export async function clearCloudHistory(session: Session) {
  await supabase
    .from('synced_history')
    .delete()
    .eq('user_id', session.user.id);
}
