import type { NormalizedFile } from '../lib/fileUtils';
import { parseSSEStream, parseApiError, type StreamCallbacks } from '../lib/streamUtils';
import { getResponseLengthConfig } from '../lib/responseLength';
import type { ConversationTurn } from './index';

const BASE_URL = 'https://api.anthropic.com/v1';

export async function streamAnthropic(
  apiKey: string,
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  history?: ConversationTurn[],
): Promise<void> {
  const content: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (file.type === 'image') {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.mimeType,
          data: file.base64Data,
        },
      });
    } else if (file.type === 'pdf') {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: file.base64Data,
        },
      });
    } else if (file.type === 'text') {
      const text = atob(file.base64Data);
      content.push({
        type: 'text',
        text: `[Content from ${file.filename}]:\n${text}`,
      });
    }
  }

  content.push({ type: 'text', text: query });

  const { systemPrompt, maxTokens, temperature } = getResponseLengthConfig();

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    stream: true,
    messages: [
      ...(history || []).map(turn => ({
        role: turn.role,
        content: turn.content,
      })),
      { role: 'user' as const, content },
    ],
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(parseApiError('Anthropic', response.status, error));
  }

  const reader = response.body!.getReader();
  let inputTokens = 0;
  let outputTokens = 0;

  await parseSSEStream(reader, (data) => {
    const parsed = JSON.parse(data);
    // Capture usage from message_start
    if (parsed.type === 'message_start' && parsed.message?.usage) {
      inputTokens = parsed.message.usage.input_tokens || 0;
    }
    // Capture output tokens from message_delta
    if (parsed.type === 'message_delta' && parsed.usage) {
      outputTokens = parsed.usage.output_tokens || 0;
      callbacks.onUsage({ inputTokens, outputTokens });
    }
    if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
      return parsed.delta.text || null;
    }
    return null;
  }, callbacks, signal);
}

export async function testAnthropicKey(apiKey: string): Promise<boolean> {
  // Use /v1/models to verify key without spending tokens
  const modelsResponse = await fetch(`${BASE_URL}/models`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
  if (modelsResponse.ok) return true;

  // Fallback: try a minimal message to verify billing
  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });
  if (response.status === 401) {
    throw new Error('Invalid or restricted API key. Make sure your key has full permissions.');
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(parseApiError('Anthropic', response.status, error));
  }
  return true;
}

export async function discoverAnthropicModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/models`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.data as Array<{ id: string }>)
    .map(m => m.id)
    .sort();
}
