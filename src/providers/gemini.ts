import type { NormalizedFile } from '../lib/fileUtils';
import { parseApiError, type StreamCallbacks } from '../lib/streamUtils';
import { getResponseLengthConfig } from '../lib/responseLength';
import type { ConversationTurn } from './index';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export async function streamGemini(
  apiKey: string,
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  history?: ConversationTurn[],
): Promise<void> {
  const parts: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (file.type === 'image' || file.type === 'pdf') {
      parts.push({
        inline_data: {
          mime_type: file.mimeType,
          data: file.base64Data,
        },
      });
    } else if (file.type === 'text') {
      const text = atob(file.base64Data);
      parts.push({ text: `[Content from ${file.filename}]:\n${text}` });
    }
  }

  parts.push({ text: query });

  const url = `${BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const { systemPrompt, maxTokens, temperature } = getResponseLengthConfig();

  const body: Record<string, unknown> = {
    contents: [
      ...(history || []).map(turn => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })),
      { role: 'user', parts },
    ],
    generationConfig: { maxOutputTokens: 4096, temperature },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(parseApiError('Gemini', response.status, error));
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              callbacks.onToken(text);
            }
            // Extract usage metadata
            if (parsed.usageMetadata) {
              callbacks.onUsage({
                inputTokens: parsed.usageMetadata.promptTokenCount || 0,
                outputTokens: parsed.usageMetadata.candidatesTokenCount || 0,
              });
            }
          } catch {
            // Skip malformed JSON
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

export async function testGeminiKey(apiKey: string): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/models?key=${apiKey}`);
  if (response.status === 400 || response.status === 403) {
    throw new Error('Invalid or restricted API key. Make sure your key has full permissions.');
  }
  return response.ok;
}

export async function discoverGeminiModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/models?key=${apiKey}`);
  if (!response.ok) return [];
  const data = await response.json();
  return (data.models as Array<{ name: string; supportedGenerationMethods?: string[] }>)
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .filter(id => id.startsWith('gemini-'))
    .sort();
}
