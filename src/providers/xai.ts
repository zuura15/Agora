import { type NormalizedFile, extractTextFromPdf } from '../lib/fileUtils';
import { parseSSEStream, parseApiError, type StreamCallbacks } from '../lib/streamUtils';
import { getResponseLengthConfig } from '../lib/responseLength';
import type { ConversationTurn } from './index';

const BASE_URL = 'https://api.x.ai/v1';

export async function streamXAI(
  apiKey: string,
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  history?: ConversationTurn[],
): Promise<void> {
  const { systemPrompt, temperature } = getResponseLengthConfig();

  // Use Chat Completions API for multi-turn support
  const messages: Array<Record<string, unknown>> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (history?.length) {
    for (const turn of history) {
      messages.push({ role: turn.role, content: turn.content });
    }
  }

  // Build current user message
  if (files.length > 0) {
    const parts: Array<Record<string, unknown>> = [];
    for (const file of files) {
      if (file.type === 'image') {
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${file.mimeType};base64,${file.base64Data}` },
        });
      } else if (file.type === 'pdf') {
        const text = await extractTextFromPdf(file);
        parts.push({ type: 'text', text: `[Content from ${file.filename}]:\n${text}` });
      } else if (file.type === 'text') {
        const text = atob(file.base64Data);
        parts.push({ type: 'text', text: `[Content from ${file.filename}]:\n${text}` });
      }
    }
    parts.push({ type: 'text', text: query });
    messages.push({ role: 'user', content: parts });
  } else {
    messages.push({ role: 'user', content: query });
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(parseApiError('xAI', response.status, error));
  }

  const reader = response.body!.getReader();
  parseSSEStream(reader, (data) => {
    const parsed = JSON.parse(data);
    const delta = parsed.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') return delta;
    // Usage
    if (parsed.usage) {
      callbacks.onUsage({
        inputTokens: parsed.usage.prompt_tokens || 0,
        outputTokens: parsed.usage.completion_tokens || 0,
      });
    }
    return null;
  }, callbacks, signal);
}

export async function testXAIKey(apiKey: string): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/language-models`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (response.status === 401) {
    throw new Error('Invalid or restricted API key. Make sure your key has full permissions.');
  }
  return response.ok;
}

export async function discoverXAIModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/language-models`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!response.ok) return [];
  const data = await response.json();
  if (Array.isArray(data.models)) {
    return (data.models as Array<{ id: string }>).map(m => m.id).sort();
  }
  if (Array.isArray(data.data)) {
    return (data.data as Array<{ id: string }>).map(m => m.id).sort();
  }
  return [];
}
