export type Provider = 'anthropic' | 'openai' | 'glm' | 'anthropic-compatible';

export const PROVIDER_BASE_URLS: Readonly<Record<Provider, string | undefined>> = {
  anthropic: undefined,
  openai: undefined,
  glm: 'https://api.z.ai/api/paas/v4',
  'anthropic-compatible': 'https://api.z.ai/api/anthropic',
};

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && Object.hasOwn(PROVIDER_BASE_URLS, value);
}

/**
 * Resolve an SDK endpoint without allowing a previous provider's endpoint to
 * leak across a provider switch. Only the explicitly custom-compatible mode
 * accepts a caller-provided URL; first-party providers always use their own
 * SDK default or documented endpoint.
 */
export function resolveProviderBaseURL(provider: Provider, customBaseURL?: string): string | undefined {
  if (provider === 'anthropic-compatible') {
    const custom = customBaseURL?.trim().replace(/\/+$/, '');
    return custom || PROVIDER_BASE_URLS[provider];
  }
  return PROVIDER_BASE_URLS[provider];
}

export function sdkBaseURLOption(provider: Provider, customBaseURL?: string): { baseURL?: string } {
  const baseURL = resolveProviderBaseURL(provider, customBaseURL);
  return baseURL ? { baseURL } : {};
}

export function resolveSettingsBaseURL(
  previousProvider: Provider,
  nextProvider: Provider,
  currentBaseURL: string | undefined,
  submittedBaseURL: string | undefined
): string | undefined {
  if (nextProvider !== 'anthropic-compatible') return resolveProviderBaseURL(nextProvider);
  if (submittedBaseURL !== undefined) return resolveProviderBaseURL(nextProvider, submittedBaseURL);
  if (previousProvider === nextProvider) return resolveProviderBaseURL(nextProvider, currentBaseURL);
  return resolveProviderBaseURL(nextProvider);
}
