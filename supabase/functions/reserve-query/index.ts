import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[reserve-query] request received');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('[reserve-query] missing authorization header');
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[reserve-query] auth header present, verifying user...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error('[reserve-query] auth failed', { error: authError?.message, hasUser: !!user });
    return new Response(JSON.stringify({ error: 'Invalid token', detail: authError?.message }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[reserve-query] user verified', { id: user.id, email: user.email });

  // Check which owner keys are available
  const availableProviders: string[] = [];
  if (Deno.env.get('OWNER_OPENAI_KEY')) availableProviders.push('openai');
  if (Deno.env.get('OWNER_ANTHROPIC_KEY')) availableProviders.push('anthropic');
  if (Deno.env.get('OWNER_GEMINI_KEY')) availableProviders.push('gemini');
  if (Deno.env.get('OWNER_XAI_KEY')) availableProviders.push('xai');
  console.log('[reserve-query] available providers', availableProviders);

  // Support check_only mode
  try {
    const body = await req.json().catch(() => ({}));
    console.log('[reserve-query] body', body);
    if (body.check_only) {
      console.log('[reserve-query] check_only mode, returning providers');
      return new Response(JSON.stringify({
        available_providers: availableProviders,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch { /* empty body is fine for non-check_only */ }

  try {
    console.log('[reserve-query] calling reserve_query RPC for user', user.id);
    const { data, error } = await supabase.rpc('reserve_query', {
      p_user_id: user.id,
      p_estimated_cost: 0.05,
    });

    if (error) {
      const msg = error.message || '';
      console.error('[reserve-query] RPC error', { message: msg });
      if (msg.includes('NO_CREDIT')) {
        return new Response(JSON.stringify({ error: 'No credit remaining', reason: 'NO_CREDIT' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (msg.includes('RATE_LIMITED')) {
        return new Response(JSON.stringify({ error: 'Daily query limit reached', reason: 'RATE_LIMITED' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    console.log('[reserve-query] reservation created', row);

    return new Response(JSON.stringify({
      query_group_id: row.query_group_id,
      active_code_id: row.active_code_id,
      remaining_credit: Number(row.total_remaining_credit),
      queries_today: row.queries_today,
      daily_limit: row.daily_limit,
      available_providers: availableProviders,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[reserve-query] unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
