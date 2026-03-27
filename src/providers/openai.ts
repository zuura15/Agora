import { type NormalizedFile, extractTextFromPdf } from '../lib/fileUtils';
import { parseApiError, type StreamCallbacks } from '../lib/streamUtils';
import { getResponseLengthConfig } from '../lib/responseLength';
import type { ConversationTurn } from './index';

const BASE_URL = 'https://api.openai.com/v1';

export async function streamOpenAI(
  apiKey: string,
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  history?: ConversationTurn[],
): Promise<void> {
  const { systemPrompt, temperature } = getResponseLengthConfig();

  // Use Chat Completions API — works for both single and multi-turn
  const messages: Array<Record<string, unknown>> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Add conversation history
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
      stream_options: { include_usage: true },
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(parseApiError('OpenAI', response.status, error));
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  function done() {
    if (finished) return;
    finished = true;
    callbacks.onDone();
  }

  await new Promise<void>((resolve) => {

  function pump(): void {
    if (signal?.aborted) {
      reader.cancel();
      done();
      resolve();
      return;
    }
    reader.read().then(({ done: readerDone, value }) => {
      if (readerDone) {
        done();
        resolve();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            done();
            resolve();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            // Chat Completions streaming delta
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string') {
              callbacks.onToken(delta);
            }
            // Usage (sent in the last chunk with stream_options)
            if (parsed.usage) {
              callbacks.onUsage({
                inputTokens: parsed.usage.prompt_tokens || 0,
                outputTokens: parsed.usage.completion_tokens || 0,
              });
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
      pump();
    }).catch((err) => {
      if (signal?.aborted) {
        done();
      } else {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
      resolve();
    });
  }

  pump();
  }); // close Promise wrapper
}

export async function testOpenAIKey(apiKey: string): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/models`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (response.status === 401) {
    throw new Error('Invalid or restricted API key. Make sure your key has full permissions (not read-only).');
  }
  return response.ok;
}

export async function discoverOpenAIModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/models`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.data as Array<{ id: string }>)
    .map(m => m.id)
    .filter(id => id.startsWith('gpt-'))
    .sort();
}
