import { supabase } from '../lib/supabase';
import { parseApiError, type StreamCallbacks } from '../lib/streamUtils';
import type { NormalizedFile } from '../lib/fileUtils';
import { extractTextFromPdf } from '../lib/fileUtils';
import type { ConversationTurn } from '../providers/index';
import { useAppStore } from '../store/appStore';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface ProxyReservation {
  query_group_id: string;
  active_code_id: string;
}

export async function proxyStream(
  providerId: string,
  _apiKey: string, // Ignored — key is fetched server-side
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  _history?: ConversationTurn[],
  reservation?: ProxyReservation,
): Promise<void> {
  // Build the input in the same format as the direct adapters
  const content: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (file.type === 'image') {
      content.push({
        type: 'input_image',
        image_url: `data:${file.mimeType};base64,${file.base64Data}`,
      });
    } else if (file.type === 'pdf') {
      const text = await extractTextFromPdf(file);
      content.push({
        type: 'input_text',
        text: `[Content from ${file.filename}]:\n${text}`,
      });
    } else if (file.type === 'text') {
      const text = atob(file.base64Data);
      content.push({
        type: 'input_text',
        text: `[Content from ${file.filename}]:\n${text}`,
      });
    }
  }

  content.push({ type: 'input_text', text: query });

  const input = [{ role: 'user', content }];

  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated — sign in to use proxy mode');
  }

  // Build request body with optional access code fields
  const { queryMode, responseLength } = useAppStore.getState();
  const isAccessCode = queryMode === 'access-code' && reservation;

  const body: Record<string, unknown> = {
    provider_id: providerId,
    model,
    input,
  };

  if (isAccessCode) {
    body.access_code_mode = true;
    body.query_group_id = reservation.query_group_id;
    body.active_code_id = reservation.active_code_id;
    body.request_id = crypto.randomUUID(); // Unique per provider call
    body.response_length = responseLength;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(parseApiError('Proxy', response.status, error));
  }

  // Parse SSE stream (handles OpenAI, Anthropic, Gemini, xAI formats)
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let anthropicInputTokens = 0;

  function pump(): void {
    if (signal?.aborted) {
      reader.cancel();
      callbacks.onDone();
      return;
    }
    reader.read().then(({ done, value }) => {
      if (done) {
        callbacks.onDone();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);

            // OpenAI / xAI format
            if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
              callbacks.onToken(parsed.delta);
            }
            if (parsed.type === 'response.completed' && !signal?.aborted) {
              const resp = parsed.response;
              if (resp?.usage) {
                callbacks.onUsage({
                  inputTokens: resp.usage.input_tokens || 0,
                  outputTokens: resp.usage.output_tokens || 0,
                });
              }
            }

            // Anthropic format
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              callbacks.onToken(parsed.delta.text);
            }
            if (parsed.type === 'message_start' && parsed.message?.usage) {
              anthropicInputTokens = parsed.message.usage.input_tokens || 0;
            }
            if (parsed.type === 'message_delta' && parsed.usage) {
              callbacks.onUsage({
                inputTokens: anthropicInputTokens,
                outputTokens: parsed.usage.output_tokens || 0,
              });
            }
            if (parsed.type === 'message_stop') {
              // Anthropic stream end — don't call onDone here, let argeon:balance or [DONE] handle it
            }

            // Gemini format
            if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
              callbacks.onToken(parsed.candidates[0].content.parts[0].text);
            }
            if (parsed.usageMetadata) {
              callbacks.onUsage({
                inputTokens: parsed.usageMetadata.promptTokenCount || 0,
                outputTokens: parsed.usageMetadata.candidatesTokenCount || 0,
              });
            }

            // Access code balance update
            if (parsed.type === 'argeon:balance') {
              const store = useAppStore.getState();
              if (typeof parsed.remaining_credit === 'number') {
                store.setTotalBalance(parsed.remaining_credit);
              }
              if (typeof parsed.queries_today === 'number') {
                store.setDailyQueryCount(parsed.queries_today);
              }
            }

            // Error
            if (parsed.type === 'error') {
              callbacks.onError(new Error(parsed.error?.message || 'Proxy stream error'));
              return;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
      pump();
    }).catch((err) => {
      if (signal?.aborted) {
        callbacks.onDone();
      } else {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  pump();
}
