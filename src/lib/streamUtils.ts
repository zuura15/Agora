export function parseApiError(providerName: string, status: number, body: string): string {
  try {
    const json = JSON.parse(body);
    const msg = json?.error?.message || json?.message || json?.error || null;
    if (typeof msg === 'string') return `${providerName}: ${msg}`;
  } catch {
    // not JSON
  }
  return `${providerName} API error (${status}): ${body.slice(0, 200)}`;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onUsage: (usage: TokenUsage) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

// Pricing per million tokens [input, output] in USD
const MODEL_PRICING: Record<string, [number, number]> = {
  // OpenAI
  'gpt-4o': [2.5, 10],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4-turbo': [10, 30],
  'gpt-4': [30, 60],
  'gpt-3.5-turbo': [0.5, 1.5],
  // Anthropic
  'claude-opus-4-6': [15, 75],
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-4-5-20250929': [3, 15],
  'claude-opus-4-5-20251101': [15, 75],
  'claude-haiku-4-5-20251001': [0.8, 4],
  'claude-sonnet-4-20250514': [3, 15],
  'claude-opus-4-20250514': [15, 75],
  // Gemini
  'gemini-2.5-pro': [1.25, 10],
  'gemini-2.5-flash': [0.15, 0.6],
  // xAI
  'grok-3': [3, 15],
  'grok-3-mini': [0.3, 0.5],
};

export function estimateCost(model: string, usage: TokenUsage): number | null {
  // Try exact match first, then prefix match
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const key = Object.keys(MODEL_PRICING).find(k => model.startsWith(k));
    if (key) pricing = MODEL_PRICING[key];
  }
  if (!pricing) return null;
  const [inputRate, outputRate] = pricing;
  return (usage.inputTokens * inputRate + usage.outputTokens * outputRate) / 1_000_000;
}

export function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  extractText: (data: string) => string | null,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve) => {
  const originalOnDone = callbacks.onDone;
  const originalOnError = callbacks.onError;
  callbacks = {
    ...callbacks,
    onDone: () => { originalOnDone(); resolve(); },
    onError: (err) => { originalOnError(err); resolve(); },
  };
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
            const text = extractText(data);
            if (text) {
              callbacks.onToken(text);
            }
          } catch {
            // Skip malformed JSON lines
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
  }); // close Promise wrapper
}

export async function* parseSSEStreamAsync(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  extractText: (data: string) => string | null,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const text = extractText(data);
          if (text) yield text;
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}
