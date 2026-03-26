import { useAppStore } from '../store/appStore';

const SYSTEM_PROMPTS = {
  normal: null,
  brief: 'Be concise. Give brief, direct answers in 2-3 sentences. Skip preamble and filler. Use bullet points for lists.',
  superbrief: 'Respond in 1-2 sentences maximum. No preamble, no caveats, no elaboration. Just the direct answer.',
};

const MAX_TOKENS = {
  normal: 4096,
  brief: 1024,
  superbrief: 256,
};

export function getResponseLengthConfig() {
  const state = useAppStore.getState();
  const level = state.responseLength;
  return {
    systemPrompt: SYSTEM_PROMPTS[level],
    maxTokens: MAX_TOKENS[level],
    temperature: state.temperature,
    level,
  };
}
