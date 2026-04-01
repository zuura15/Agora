import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  console.log('[redeem-code] Request received', { method: req.method, url: req.url });

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    console.log('[redeem-code] Method not allowed', { method: req.method });
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  console.log('[redeem-code] Auth header check', { hasAuthHeader: !!authHeader });
  if (!authHeader) {
    console.error('[redeem-code] Missing authorization header');
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  console.log('[redeem-code] User verification result', {
    userId: user?.id,
    email: user?.email,
    authError: authError?.message,
  });

  if (authError || !user) {
    console.error('[redeem-code] Invalid token', { authError: authError?.message });
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { code } = await req.json();
    console.log('[redeem-code] Code submitted', { code, userId: user.id, email: user.email });

    if (!code || typeof code !== 'string') {
      console.error('[redeem-code] Invalid input', { code, type: typeof code });
      return new Response(JSON.stringify({ error: 'Missing code', reason: 'INVALID_INPUT' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the code
    const normalizedCode = code.trim().toUpperCase();
    const { data: codeRow, error: findError } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    console.log('[redeem-code] Code lookup result', {
      normalizedCode,
      found: !!codeRow,
      codeId: codeRow?.id,
      blocked: codeRow?.blocked,
      redeemedBy: codeRow?.redeemed_by,
      findError: findError?.message,
    });

    if (findError || !codeRow) {
      console.error('[redeem-code] Code not found', { normalizedCode, findError: findError?.message });
      return new Response(JSON.stringify({ error: 'Invalid code', reason: 'NOT_FOUND' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (codeRow.blocked) {
      console.error('[redeem-code] Code is blocked', { codeId: codeRow.id, code: codeRow.code });
      return new Response(JSON.stringify({ error: 'Code is blocked', reason: 'BLOCKED' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (codeRow.redeemed_by) {
      console.error('[redeem-code] Code already redeemed', { codeId: codeRow.id, redeemedBy: codeRow.redeemed_by });
      return new Response(JSON.stringify({ error: 'Already redeemed', reason: 'ALREADY_REDEEMED' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call redeem_code RPC (handles max-3 atomically)
    console.log('[redeem-code] Calling redeem_code RPC', {
      userId: user.id,
      email: user.email,
      codeId: codeRow.id,
    });

    const { error: redeemError } = await supabase.rpc('redeem_code', {
      p_user_id: user.id,
      p_user_email: user.email,
      p_code_id: codeRow.id,
    });

    if (redeemError) {
      const msg = redeemError.message || '';
      console.error('[redeem-code] RPC error', { message: msg, codeId: codeRow.id, userId: user.id });
      if (msg.includes('MAX_CODES_REACHED')) {
        console.error('[redeem-code] Max codes reached for user', { userId: user.id });
        return new Response(JSON.stringify({ error: 'Maximum 3 active codes', reason: 'MAX_CODES_REACHED' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (msg.includes('CODE_UNAVAILABLE')) {
        console.error('[redeem-code] Code unavailable (race condition)', { codeId: codeRow.id });
        return new Response(JSON.stringify({ error: 'Code unavailable', reason: 'CODE_UNAVAILABLE' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw redeemError;
    }

    console.log('[redeem-code] Redemption successful', {
      userId: user.id,
      email: user.email,
      codeId: codeRow.id,
      code: codeRow.code,
      initialCredit: codeRow.initial_credit,
    });

    return new Response(JSON.stringify({
      success: true,
      code: {
        id: codeRow.id,
        code: codeRow.code,
        initial_credit: codeRow.initial_credit,
        remaining_credit: codeRow.remaining_credit,
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[redeem-code] Unhandled error', { error: String(err), stack: (err as Error)?.stack });
    return new Response(JSON.stringify({ error: 'Internal error', reason: 'INTERNAL' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
