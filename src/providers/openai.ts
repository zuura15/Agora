import { type NormalizedFile, extractTextFromPdf } from '../lib/fileUtils';
import { parseSSEStream, parseApiError, type StreamCallbacks } from '../lib/streamUtils';

const BASE_URL = 'https://api.openai.com/v1';

export async function streamOpenAI(
  apiKey: string,
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  // Build content parts for the user message
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

  // Responses API expects input as a string or array of messages
  const input = [{
    role: 'user',
    content,
  }];

  const response = await fetch(`${BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      stream: true,
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
            // Responses API: text delta
            if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
              callbacks.onToken(parsed.delta);
            }
            // Completed response — extract usage and fallback text
            if (parsed.type === 'response.completed' && !signal?.aborted) {
              const resp = parsed.response;
              // Extract usage
              if (resp?.usage) {
                callbacks.onUsage({
                  inputTokens: resp.usage.input_tokens || 0,
                  outputTokens: resp.usage.output_tokens || 0,
                });
              }
              // Fallback: extract full text if we missed deltas
              const output = resp?.output;
              if (Array.isArray(output)) {
                for (const item of output) {
                  if (item.type === 'message' && Array.isArray(item.content)) {
                    for (const part of item.content) {
                      if (part.type === 'output_text' && part.text) {
                        callbacks.onToken(part.text);
                      }
                    }
                  }
                }
              }
              callbacks.onDone();
              return;
            }
            if (parsed.type === 'error') {
              callbacks.onError(new Error(parsed.error?.message || 'OpenAI stream error'));
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
