import { type NormalizedFile, extractTextFromPdf } from '../lib/fileUtils';
import { parseSSEStream, parseApiError, type StreamCallbacks } from '../lib/streamUtils';

const BASE_URL = 'https://api.x.ai/v1';

export async function streamXAI(
  apiKey: string,
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const content: Array<Record<string, unknown>> = [];

  for (const file of files) {
    if (file.type === 'image') {
      content.push({
        type: 'input_image',
        image_url: `data:${file.mimeType};base64,${file.base64Data}`,
      });
    } else if (file.type === 'pdf') {
      // xAI doesn't support PDF — extract text fallback
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
    throw new Error(parseApiError('xAI', response.status, error));
  }

  const reader = response.body!.getReader();
  parseSSEStream(reader, (data) => {
    const parsed = JSON.parse(data);
    if (parsed.type === 'response.output_text.delta') {
      return parsed.delta || null;
    }
    // Extract usage from completed event
    if (parsed.type === 'response.completed' && parsed.response?.usage) {
      callbacks.onUsage({
        inputTokens: parsed.response.usage.input_tokens || 0,
        outputTokens: parsed.response.usage.output_tokens || 0,
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
