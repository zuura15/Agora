import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL')!;

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateCode(): string {
  const seg = (len: number) => {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => CODE_CHARS[b % CODE_CHARS.length]).join('');
  };
  return `AGORA-${seg(4)}-${seg(4)}`;
}

serve(async (req) => {
  console.log('[admin-codes] Request received', { method: req.method, url: req.url });

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    console.log('[admin-codes] Method not allowed', { method: req.method });
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  console.log('[admin-codes] Auth header check', { hasAuthHeader: !!authHeader });
  if (!authHeader) {
    console.error('[admin-codes] Missing authorization header');
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  console.log('[admin-codes] User verification result', {
    email: user?.email,
    userId: user?.id,
    authError: authError?.message,
  });

  const isAdmin = !authError && user && user.email === ADMIN_EMAIL;
  console.log('[admin-codes] Admin check result', {
    isAdmin,
    userEmail: user?.email,
    adminEmail: ADMIN_EMAIL,
  });

  if (authError || !user || user.email !== ADMIN_EMAIL) {
    console.error('[admin-codes] Forbidden - not admin', {
      authError: authError?.message,
      userEmail: user?.email,
      adminEmail: ADMIN_EMAIL,
    });
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, ...params } = await req.json();
    console.log('[admin-codes] Action parsed', { action, params });

    if (action === 'check_admin') {
      console.log('[admin-codes] check_admin: returning true', { email: user.email });
      return new Response(JSON.stringify({ is_admin: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate') {
      const credit = params.initial_credit || 5;
      console.log('[admin-codes] generate: starting', { credit });
      let code: string;
      let attempts = 0;
      // Retry on collision
      while (true) {
        code = generateCode();
        console.log('[admin-codes] generate: attempting insert', { code, attempt: attempts + 1 });
        const { error } = await supabase.from('access_codes').insert({
          code,
          initial_credit: credit,
          remaining_credit: credit,
        });
        if (!error) break;
        console.error('[admin-codes] generate: insert collision', { code, error: error.message, attempt: attempts + 1 });
        if (++attempts > 5) throw new Error('Code generation failed after retries');
      }
      console.log('[admin-codes] generate: success', { code, credit });
      return new Response(JSON.stringify({ success: true, code, initial_credit: credit }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list') {
      console.log('[admin-codes] list: fetching codes and usage');
      const { data: codes, error: codesError } = await supabase
        .from('access_codes')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('[admin-codes] list: codes fetched', { count: codes?.length, error: codesError?.message });

      // Get usage stats per code
      const { data: usage, error: usageError } = await supabase
        .from('usage_log')
        .select('access_code_id, provider, cost, input_tokens, output_tokens, query_group_id');

      console.log('[admin-codes] list: usage fetched', { count: usage?.length, error: usageError?.message });

      const usageByCode: Record<string, { total_cost: number; total_input: number; total_output: number; query_count: number; by_provider: Record<string, { cost: number; input_tokens: number; output_tokens: number; count: number }> }> = {};
      for (const row of (usage || [])) {
        if (!usageByCode[row.access_code_id]) {
          usageByCode[row.access_code_id] = { total_cost: 0, total_input: 0, total_output: 0, query_count: 0, by_provider: {} };
        }
        const entry = usageByCode[row.access_code_id];
        entry.total_cost += Number(row.cost);
        entry.total_input += row.input_tokens;
        entry.total_output += row.output_tokens;
        if (!entry.by_provider[row.provider]) {
          entry.by_provider[row.provider] = { cost: 0, input_tokens: 0, output_tokens: 0, count: 0 };
        }
        entry.by_provider[row.provider].cost += Number(row.cost);
        entry.by_provider[row.provider].input_tokens += row.input_tokens;
        entry.by_provider[row.provider].output_tokens += row.output_tokens;
        entry.by_provider[row.provider].count += 1;
      }

      // Count unique query groups per code for query count
      const queryGroups: Record<string, Set<string>> = {};
      for (const row of (usage || [])) {
        if (!queryGroups[row.access_code_id]) queryGroups[row.access_code_id] = new Set();
        queryGroups[row.access_code_id].add(row.query_group_id);
      }
      for (const codeId in usageByCode) {
        usageByCode[codeId].query_count = queryGroups[codeId]?.size || 0;
      }

      console.log('[admin-codes] list: returning response', { codesCount: codes?.length });
      return new Response(JSON.stringify({
        codes: (codes || []).map(c => ({
          ...c,
          usage: usageByCode[c.id] || { total_cost: 0, total_input: 0, total_output: 0, query_count: 0, by_provider: {} },
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'block' || action === 'unblock') {
      const { code_id } = params;
      console.log('[admin-codes] block/unblock: executing', { action, codeId: code_id });
      const { error: updateError } = await supabase.from('access_codes').update({ blocked: action === 'block' }).eq('id', code_id);
      console.log('[admin-codes] block/unblock: result', { action, codeId: code_id, error: updateError?.message });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'usage') {
      console.log('[admin-codes] usage: fetching usage data');
      // Per-user stats
      const { data: userUsage, error: usageError } = await supabase
        .from('usage_log')
        .select('user_id, provider, cost, input_tokens, output_tokens, query_group_id, created_at');

      console.log('[admin-codes] usage: data fetched', { rowCount: userUsage?.length, error: usageError?.message });

      const byUser: Record<string, { total_cost: number; query_count: number; last_active: string; groups: Set<string> }> = {};
      const byProvider: Record<string, { total_cost: number; total_input: number; total_output: number; query_count: number }> = {};

      for (const row of (userUsage || [])) {
        // Per user
        if (!byUser[row.user_id]) {
          byUser[row.user_id] = { total_cost: 0, query_count: 0, last_active: '', groups: new Set() };
        }
        byUser[row.user_id].total_cost += Number(row.cost);
        byUser[row.user_id].groups.add(row.query_group_id);
        if (row.created_at > byUser[row.user_id].last_active) byUser[row.user_id].last_active = row.created_at;

        // Per provider
        if (!byProvider[row.provider]) {
          byProvider[row.provider] = { total_cost: 0, total_input: 0, total_output: 0, query_count: 0 };
        }
        byProvider[row.provider].total_cost += Number(row.cost);
        byProvider[row.provider].total_input += row.input_tokens;
        byProvider[row.provider].total_output += row.output_tokens;
        byProvider[row.provider].query_count += 1;
      }

      // Get user emails
      const userIds = Object.keys(byUser);
      console.log('[admin-codes] usage: resolving emails for users', { userCount: userIds.length });
      const userEmails: Record<string, string> = {};
      for (const uid of userIds) {
        const { data: u } = await supabase.auth.admin.getUserById(uid);
        if (u?.user?.email) userEmails[uid] = u.user.email;
      }

      const perUser = Object.entries(byUser).map(([uid, stats]) => ({
        user_id: uid,
        email: userEmails[uid] || uid,
        total_cost: stats.total_cost,
        query_count: stats.groups.size,
        last_active: stats.last_active,
      }));

      console.log('[admin-codes] usage: returning response', {
        userCount: perUser.length,
        providerCount: Object.keys(byProvider).length,
      });
      return new Response(JSON.stringify({ per_user: perUser, per_provider: byProvider }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('[admin-codes] Unknown action', { action });
    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-codes] Unhandled error', { error: String(err), stack: (err as Error)?.stack });
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
