import type { NormalizedFile } from '../lib/fileUtils';
import type { StreamCallbacks } from '../lib/streamUtils';
import { streamOpenAI, testOpenAIKey, discoverOpenAIModels } from './openai';
import { streamAnthropic, testAnthropicKey, discoverAnthropicModels } from './anthropic';
import { streamGemini, testGeminiKey, discoverGeminiModels } from './gemini';
import { streamXAI, testXAIKey, discoverXAIModels } from './xai';

export type StreamFn = (
  apiKey: string,
  model: string,
  query: string,
  files: NormalizedFile[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
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
