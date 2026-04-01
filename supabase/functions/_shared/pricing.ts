// Authoritative pricing - server-side source of truth
// Pricing per million tokens [input, output] in USD
export const MODEL_PRICING: Record<string, [number, number]> = {
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

export const ACCESS_CODE_MODEL_ALLOWLIST: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  xai: ['grok-3', 'grok-3-mini'],
};

export function estimateCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const key = Object.keys(MODEL_PRICING).find(k => model.startsWith(k));
    if (key) pricing = MODEL_PRICING[key];
  }
  if (!pricing) return 0;
  const [inputRate, outputRate] = pricing;
  return (usage.inputTokens * inputRate + usage.outputTokens * outputRate) / 1_000_000;
}
