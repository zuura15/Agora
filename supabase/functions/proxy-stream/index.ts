import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_SECRET = Deno.env.get('ENCRYPTION_SECRET')!;

// Owner keys for access code mode
const OWNER_KEYS: Record<string, string | undefined> = {
  openai: Deno.env.get('OWNER_OPENAI_KEY'),
  anthropic: Deno.env.get('OWNER_ANTHROPIC_KEY'),
  gemini: Deno.env.get('OWNER_GEMINI_KEY'),
  xai: Deno.env.get('OWNER_XAI_KEY'),
};

// Model allowlist for access code mode
const ACCESS_CODE_MODEL_ALLOWLIST: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  xai: ['grok-3', 'grok-3-mini'],
};

// Pricing per million tokens [input, output] in USD
const MODEL_PRICING: Record<string, [number, number]> = {
  'gpt-4o': [2.5, 10], 'gpt-4o-mini': [0.15, 0.6],
  'claude-opus-4-6': [15, 75], 'claude-sonnet-4-6': [3, 15],
  'claude-haiku-4-5-20251001': [0.8, 4],
  'gemini-2.5-pro': [1.25, 10], 'gemini-2.5-flash': [0.15, 0.6],
  'grok-3': [3, 15], 'grok-3-mini': [0.3, 0.5],
};

function estimateCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const key = Object.keys(MODEL_PRICING).find(k => model.startsWith(k));
    if (key) pricing = MODEL_PRICING[key];
  }
  if (!pricing) return (usage.inputTokens * 15 + usage.outputTokens * 75) / 1_000_000; // Conservative fallback: opus-tier pricing
  return (usage.inputTokens * pricing[0] + usage.outputTokens * pricing[1]) / 1_000_000;
}

async function decryptKey(ciphertext: string, ivStr: string): Promise<string> {
  const keyData = new TextEncoder().encode(ENCRYPTION_SECRET.slice(0, 32).padEnd(32, '0'));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

interface ProviderConfig {
  buildUrl: (model: string, apiKey: string) => string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (model: string, input: unknown, responseLength?: string) => unknown;
  extractUsage: (sseData: string, accumulated: { inputTokens: number; outputTokens: number }) => { inputTokens: number; outputTokens: number };
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    buildUrl: () => 'https://api.openai.com/v1/responses',
    buildHeaders: (apiKey) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }),
    buildBody: (model, input, responseLength) => {
      const maxTokens = responseLength === 'superbrief' ? 256 : responseLength === 'brief' ? 512 : 4096;
      return { model, input, stream: true, max_output_tokens: maxTokens };
    },
    extractUsage: (data, acc) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'response.completed' && parsed.response?.usage) {
          return { inputTokens: parsed.response.usage.input_tokens || 0, outputTokens: parsed.response.usage.output_tokens || 0 };
        }
      } catch {}
      return acc;
    },
  },
  xai: {
    buildUrl: () => 'https://api.x.ai/v1/responses',
    buildHeaders: (apiKey) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }),
    buildBody: (model, input, responseLength) => {
      const maxTokens = responseLength === 'superbrief' ? 256 : responseLength === 'brief' ? 512 : 4096;
      return { model, input, stream: true, max_output_tokens: maxTokens };
    },
    extractUsage: (data, acc) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'response.completed' && parsed.response?.usage) {
          return { inputTokens: parsed.response.usage.input_tokens || 0, outputTokens: parsed.response.usage.output_tokens || 0 };
        }
      } catch {}
      return acc;
    },
  },
  anthropic: {
    buildUrl: () => 'https://api.anthropic.com/v1/messages',
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
    buildBody: (model, input, responseLength) => {
      const maxTokens = responseLength === 'superbrief' ? 256 : responseLength === 'brief' ? 512 : 4096;
      // Convert from OpenAI-style input to Anthropic messages format
      const messages = Array.isArray(input) ? input.map((msg: any) => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content :
          Array.isArray(msg.content) ? msg.content.map((block: any) => {
            if (block.type === 'input_text') return { type: 'text', text: block.text };
            if (block.type === 'input_image') return { type: 'image', source: { type: 'base64', media_type: block.image_url?.split(';base64,')[0]?.replace('data:', '') || 'image/png', data: block.image_url?.split(';base64,')[1] || '' } };
            return { type: 'text', text: JSON.stringify(block) };
          }) : msg.content,
      })) : input;
      return { model, messages, max_tokens: maxTokens, stream: true };
    },
    extractUsage: (data, acc) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'message_start' && parsed.message?.usage) {
          acc.inputTokens = parsed.message.usage.input_tokens || 0;
        }
        if (parsed.type === 'message_delta' && parsed.usage) {
          acc.outputTokens = parsed.usage.output_tokens || 0;
        }
      } catch {}
      return acc;
    },
  },
  gemini: {
    buildUrl: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    buildHeaders: (apiKey) => ({ 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }),
    buildBody: (model, input, responseLength) => {
      // Gemini 2.5 uses thinking tokens that count against maxOutputTokens,
      // so we give it 4x the limit to compensate for internal reasoning overhead
      const baseTokens = responseLength === 'superbrief' ? 256 : responseLength === 'brief' ? 512 : 4096;
      const maxTokens = baseTokens * 4;
      // Convert from OpenAI-style input to Gemini format
      const contents = Array.isArray(input) ? input.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: typeof msg.content === 'string' ? [{ text: msg.content }] :
          Array.isArray(msg.content) ? msg.content.map((block: any) => {
            if (block.type === 'input_text') return { text: block.text };
            if (block.type === 'input_image') return { inlineData: { mimeType: block.image_url?.split(';base64,')[0]?.replace('data:', '') || 'image/png', data: block.image_url?.split(';base64,')[1] || '' } };
            return { text: JSON.stringify(block) };
          }) : [{ text: JSON.stringify(msg.content) }],
      })) : input;
      return { contents, generationConfig: { maxOutputTokens: maxTokens } };
    },
    extractUsage: (data, acc) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.usageMetadata) {
          acc.inputTokens = parsed.usageMetadata.promptTokenCount || acc.inputTokens;
          acc.outputTokens = parsed.usageMetadata.candidatesTokenCount || acc.outputTokens;
        }
      } catch {}
      return acc;
    },
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

  console.log('[proxy-stream] request received');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('[proxy-stream] missing auth header');
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error('[proxy-stream] auth failed', { error: authError?.message, hasUser: !!user });
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { provider_id, model, input, access_code_mode, query_group_id, active_code_id, request_id, response_length } = body;
  console.log('[proxy-stream]', { provider_id, model, access_code_mode, query_group_id: query_group_id?.substring(0, 8), request_id: request_id?.substring(0, 8), response_length });
  // Server computes estimated cost per provider — never trust client
  const RESERVATION_AMOUNT = 0.05;
  const MAX_PROVIDERS = 4;

  const config = PROVIDER_CONFIGS[provider_id];
  if (!config) {
    return new Response(JSON.stringify({ error: `Unsupported provider: ${provider_id}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let apiKey: string;

  if (access_code_mode) {
    console.log('[proxy-stream] access-code mode — validating reservation');
    // Validate reservation exists and belongs to this user
    if (!query_group_id || !active_code_id) {
      console.error('[proxy-stream] missing reservation data');
      return new Response(JSON.stringify({ error: 'Missing reservation data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side verification: check that query_group_id was actually reserved by this user today
    const today = new Date().toISOString().slice(0, 10);
    const { data: dailyRow } = await supabase
      .from('daily_usage')
      .select('query_count')
      .eq('user_id', user.id)
      .eq('usage_date', today)
      .single();

    if (!dailyRow || dailyRow.query_count <= 0) {
      return new Response(JSON.stringify({ error: 'No valid reservation found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify active_code_id belongs to this user
    const { data: codeRow } = await supabase
      .from('access_codes')
      .select('id')
      .eq('id', active_code_id)
      .eq('redeemed_by_user_id', user.id)
      .eq('blocked', false)
      .single();

    if (!codeRow) {
      return new Response(JSON.stringify({ error: 'Invalid access code' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Access code mode: use owner's key
    console.log('[proxy-stream] reservation validated, using owner key for', provider_id);
    const ownerKey = OWNER_KEYS[provider_id];
    if (!ownerKey) {
      console.error('[proxy-stream] no owner key for', provider_id);
      return new Response(JSON.stringify({ error: `Provider ${provider_id} not available` }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate model is in allowlist (exact match only, no prefix)
    const allowlist = ACCESS_CODE_MODEL_ALLOWLIST[provider_id] || [];
    if (!allowlist.includes(model)) {
      return new Response(JSON.stringify({ error: `Model ${model} not allowed in access code mode` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate response length
    if (response_length === 'normal') {
      return new Response(JSON.stringify({ error: 'Normal response length not allowed in access code mode' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate input size (100KB limit)
    const inputStr = JSON.stringify(input);
    if (inputStr.length > 100_000) {
      return new Response(JSON.stringify({ error: 'Input too large for access code mode' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    apiKey = ownerKey;
  } else {
    // BYOK mode: fetch and decrypt user's key
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

    try {
      apiKey = await decryptKey(keyRow.encrypted_key, keyRow.iv);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to decrypt API key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Forward request to provider
  const url = config.buildUrl(model, apiKey);
  console.log('[proxy-stream] forwarding to provider', { provider_id, model, url: url.substring(0, 60) });
  const providerResponse = await fetch(url, {
    method: 'POST',
    headers: config.buildHeaders(apiKey),
    body: JSON.stringify(config.buildBody(model, input, response_length)),
  });

  console.log('[proxy-stream] provider response', { provider_id, status: providerResponse.status });

  if (!providerResponse.ok) {
    const errorText = await providerResponse.text();
    console.error('[proxy-stream] provider error', { provider_id, status: providerResponse.status, error: errorText.substring(0, 200) });
    return new Response(errorText, {
      status: providerResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  if (!access_code_mode) {
    // BYOK mode: just pipe through
    return new Response(providerResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Access code mode: intercept stream for usage extraction, then settle
  const reader = providerResponse.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let sseBuffer = '';
  const usage = { inputTokens: 0, outputTokens: 0 };

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          // Settlement: calculate cost and adjust reservation
          const cost = estimateCost(model, usage);
          console.log('[proxy-stream] stream done, settling', { provider_id, usage, cost, estimated: RESERVATION_AMOUNT / MAX_PROVIDERS });
          try {
            const { data: newBalance } = await supabase.rpc('settle_usage', {
              p_user_id: user!.id,
              p_query_group_id: query_group_id,
              p_code_id: active_code_id,
              p_actual_total_cost: cost,
              p_estimated_cost: RESERVATION_AMOUNT / MAX_PROVIDERS,
            });

            // Insert usage log (idempotent via request_id unique constraint)
            await supabase.from('usage_log').insert({
              user_id: user!.id,
              access_code_id: active_code_id,
              provider: provider_id,
              model,
              input_tokens: usage.inputTokens,
              output_tokens: usage.outputTokens,
              cost,
              query_group_id,
              request_id,
              settled: true,
            }).single();

            // Get daily query count
            const today = new Date().toISOString().slice(0, 10);
            const { data: dailyData } = await supabase
              .from('daily_usage')
              .select('query_count')
              .eq('user_id', user!.id)
              .eq('usage_date', today)
              .single();

            // Send balance update event
            const balanceEvent = `data: ${JSON.stringify({
              type: 'argeon:balance',
              remaining_credit: typeof newBalance === 'number' ? newBalance : Number(newBalance),
              queries_today: dailyData?.query_count || 0,
            })}\n\n`;
            controller.enqueue(encoder.encode(balanceEvent));
          } catch (err) {
            // Settlement failed — reservation stands. Log but don't fail the stream.
            console.error('[proxy-stream] settlement failed', { provider_id, err });
          }

          controller.close();
          return;
        }

        // Pass through the chunk
        controller.enqueue(value);

        // Parse SSE for usage extraction
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data && data !== '[DONE]') {
              const updated = config.extractUsage(data, usage);
              usage.inputTokens = updated.inputTokens;
              usage.outputTokens = updated.outputTokens;
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      reader.cancel();
      // Settlement on abort: use whatever usage we've collected, or reservation stands
      try {
        const cost = estimateCost(model, usage);
        await supabase.rpc('settle_usage', {
          p_user_id: user!.id,
          p_query_group_id: query_group_id,
          p_code_id: active_code_id,
          p_actual_total_cost: cost,
          p_estimated_cost: RESERVATION_AMOUNT / MAX_PROVIDERS,
        });
      } catch {
        // Settlement failed on abort — reservation stands
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
