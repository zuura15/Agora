import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_SECRET = Deno.env.get('ENCRYPTION_SECRET')!;

async function decryptKey(ciphertext: string, ivStr: string): Promise<string> {
  const keyData = new TextEncoder().encode(ENCRYPTION_SECRET.slice(0, 32).padEnd(32, '0'));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

const PROVIDER_CONFIGS: Record<string, {
  baseUrl: string;
  endpoint: string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (model: string, input: unknown) => unknown;
}> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    endpoint: '/responses',
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    buildBody: (model, input) => ({ model, input, stream: true }),
  },
  xai: {
    baseUrl: 'https://api.x.ai/v1',
    endpoint: '/responses',
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    buildBody: (model, input) => ({ model, input, stream: true }),
  },
};

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { provider_id, model, input } = await req.json();

  const config = PROVIDER_CONFIGS[provider_id];
  if (!config) {
    return new Response(JSON.stringify({ error: `Unsupported provider: ${provider_id}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch and decrypt the user's API key for this provider
  const { data: keyRow, error: keyError } = await supabase
    .from('encrypted_keys')
    .select('encrypted_key, iv')
    .eq('user_id', user.id)
    .eq('provider_id', provider_id)
    .single();

  if (keyError || !keyRow) {
    return new Response(JSON.stringify({ error: `No API key found for ${provider_id}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let apiKey: string;
  try {
    apiKey = await decryptKey(keyRow.encrypted_key, keyRow.iv);
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to decrypt API key' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Forward request to provider
  const url = `${config.baseUrl}${config.endpoint}`;
  const providerResponse = await fetch(url, {
    method: 'POST',
    headers: config.buildHeaders(apiKey),
    body: JSON.stringify(config.buildBody(model, input)),
  });

  if (!providerResponse.ok) {
    const errorText = await providerResponse.text();
    return new Response(errorText, {
      status: providerResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  // Stream the SSE response back to the client
  return new Response(providerResponse.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
