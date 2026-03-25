export interface ProviderCapability {
  id: string;
  name: string;
  apiStyle: 'openai-responses' | 'anthropic-messages' | 'gemini-generate' | 'xai-responses';
  supportsDirectBrowserCalls: 'supported' | 'possible-but-discouraged' | 'unsupported';
  browserKeyExposurePosture: 'approved' | 'supported-with-warning' | 'discouraged';
  supportsStreaming: boolean;
  supportsImageInput: boolean;
  supportsPdfInput: boolean;
  supportsModelDiscovery: boolean;
  defaultModels: string[];
  retentionNote: string;
  brandColor: string;
  keyDashboardUrl: string;
  keyPlaceholder: string;
}

export const PROVIDERS: Record<string, ProviderCapability> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    apiStyle: 'openai-responses',
    supportsDirectBrowserCalls: 'possible-but-discouraged',
    browserKeyExposurePosture: 'discouraged',
    supportsStreaming: true,
    supportsImageInput: true,
    supportsPdfInput: false,
    supportsModelDiscovery: true,
    defaultModels: ['gpt-4o', 'gpt-4o-mini'],
    retentionNote: 'OpenAI retains API inputs/outputs for up to 30 days per their data controls policy (platform.openai.com/docs/guides/your-data)',
    brandColor: '#10a37f',
    keyDashboardUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    apiStyle: 'anthropic-messages',
    supportsDirectBrowserCalls: 'supported',
    browserKeyExposurePosture: 'supported-with-warning',
    supportsStreaming: true,
    supportsImageInput: true,
    supportsPdfInput: true,
    supportsModelDiscovery: true,
    defaultModels: ['claude-sonnet-4-6', 'claude-opus-4-6'],
    retentionNote: 'Anthropic retains API data for up to 30 days in standard cases per their privacy policy (anthropic.com/privacy)',
    brandColor: '#d4a27f',
    keyDashboardUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    apiStyle: 'gemini-generate',
    supportsDirectBrowserCalls: 'supported',
    browserKeyExposurePosture: 'approved',
    supportsStreaming: true,
    supportsImageInput: true,
    supportsPdfInput: true,
    supportsModelDiscovery: true,
    defaultModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    retentionNote: "Subject to Google's Gemini API data logging and sharing policy — see ai.google.dev/gemini-api/docs/logs-policy",
    brandColor: '#4285f4',
    keyDashboardUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
  },
  xai: {
    id: 'xai',
    name: 'xAI (Grok)',
    apiStyle: 'xai-responses',
    supportsDirectBrowserCalls: 'possible-but-discouraged',
    browserKeyExposurePosture: 'discouraged',
    supportsStreaming: true,
    supportsImageInput: true,
    supportsPdfInput: false,
    supportsModelDiscovery: true,
    defaultModels: ['grok-3', 'grok-3-mini'],
    retentionNote: 'xAI stores requests and responses for up to 30 days per their API terms (docs.x.ai)',
    brandColor: '#ffffff',
    keyDashboardUrl: 'https://console.x.ai/',
    keyPlaceholder: 'xai-...',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as Array<keyof typeof PROVIDERS>;

export function getBrowserWarning(provider: ProviderCapability): string | null {
  if (provider.browserKeyExposurePosture === 'discouraged') {
    return `${provider.name} discourages browser-side key usage. Use a dedicated key with spending limits. Although, if you're interested in this website, you probably know the trade-offs.`;
  }
  if (provider.browserKeyExposurePosture === 'supported-with-warning') {
    return `${provider.name} supports browser SDK access, but your key is still exposed client-side. Use a dedicated key. Although, if you're interested in this website, you probably know the trade-offs.`;
  }
  return null;
}
