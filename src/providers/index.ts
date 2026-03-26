import type { NormalizedFile } from '../lib/fileUtils';
import type { StreamCallbacks } from '../lib/streamUtils';
import { streamOpenAI, testOpenAIKey, discoverOpenAIModels } from './openai';
import { streamAnthropic, testAnthropicKey, discoverAnthropicModels } from './anthropic';
import { streamGemini, testGeminiKey, discoverGeminiModels } from './gemini';
import { streamXAI, testXAIKey, discoverXAIModels } from './xai';
import { proxyStream } from '../proxy/proxyStream';
import { useAppStore } from '../store/appStore';
import { supabase } from '../lib/supabase';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type StreamFn = (
  apiKey: string,
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  history?: ConversationTurn[],
) => Promise<void>;

export type TestKeyFn = (apiKey: string) => Promise<boolean>;
export type DiscoverModelsFn = (apiKey: string) => Promise<string[]>;

const streamFns: Record<string, StreamFn> = {
  openai: streamOpenAI,
  anthropic: streamAnthropic,
  gemini: streamGemini,
  xai: streamXAI,
};

const testFns: Record<string, TestKeyFn> = {
  openai: testOpenAIKey,
  anthropic: testAnthropicKey,
  gemini: testGeminiKey,
  xai: testXAIKey,
};

const discoverFns: Record<string, DiscoverModelsFn> = {
  openai: discoverOpenAIModels,
  anthropic: discoverAnthropicModels,
  gemini: discoverGeminiModels,
  xai: discoverXAIModels,
};

export function getStreamFn(providerId: string): StreamFn {
  // Check if proxy is enabled for this provider
  const { proxyProviders } = useAppStore.getState();
  if (proxyProviders?.has(providerId)) {
    // Verify user is logged in before using proxy
    const sessionPromise = supabase.auth.getSession();
    return async (apiKey, model, query, files, callbacks, signal) => {
      const { data: { session } } = await sessionPromise;
      if (session) {
        return proxyStream(providerId, apiKey, model, query, files, callbacks, signal);
      }
      // Fall back to direct if not authenticated
      const fn = streamFns[providerId];
      if (!fn) throw new Error(`Unknown provider: ${providerId}`);
      return fn(apiKey, model, query, files, callbacks, signal);
    };
  }

  const fn = streamFns[providerId];
  if (!fn) throw new Error(`Unknown provider: ${providerId}`);
  return fn;
}

export function getTestKeyFn(providerId: string): TestKeyFn {
  const fn = testFns[providerId];
  if (!fn) throw new Error(`Unknown provider: ${providerId}`);
  return fn;
}

export function getDiscoverModelsFn(providerId: string): DiscoverModelsFn {
  const fn = discoverFns[providerId];
  if (!fn) throw new Error(`Unknown provider: ${providerId}`);
  return fn;
}
