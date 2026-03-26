import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ENCRYPTION_SECRET = Deno.env.get('ENCRYPTION_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(ENCRYPTION_SECRET.slice(0, 32).padEnd(32, '0'));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function decrypt(ciphertext: string, ivStr: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

  if (req.method === 'POST') {
    // Encrypt and store a key
    const { provider_id, plaintext_key } = await req.json();
    if (!provider_id || !plaintext_key) {
      return new Response(JSON.stringify({ error: 'Missing provider_id or plaintext_key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { ciphertext, iv } = await encrypt(plaintext_key);

    const { error } = await supabase.from('encrypted_keys').upsert({
      user_id: user.id,
      provider_id,
      encrypted_key: ciphertext,
      iv,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider_id' });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'GET') {
    // Decrypt and return all keys
    const { data, error } = await supabase
      .from('encrypted_keys')
      .select('provider_id, encrypted_key, iv')
      .eq('user_id', user.id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keys: Record<string, string> = {};
    for (const row of data || []) {
      try {
        keys[row.provider_id] = await decrypt(row.encrypted_key, row.iv);
      } catch {
        // Skip keys that fail to decrypt
      }
    }

    return new Response(JSON.stringify({ keys }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
