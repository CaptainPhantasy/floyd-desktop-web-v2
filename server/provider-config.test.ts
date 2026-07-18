import { describe, expect, it } from 'vitest';
import { isProvider, resolveProviderBaseURL, resolveSettingsBaseURL, sdkBaseURLOption } from './provider-config';

describe('provider routing', () => {
  it('uses SDK defaults for first-party Anthropic and OpenAI', () => {
    expect(sdkBaseURLOption('anthropic', 'https://stale.example/v1')).toEqual({});
    expect(sdkBaseURLOption('openai', 'https://stale.example/v1')).toEqual({});
  });

  it('uses the documented Z.AI OpenAI-compatible endpoint for GLM', () => {
    expect(resolveProviderBaseURL('glm', 'https://stale.example/v1')).toBe('https://api.z.ai/api/paas/v4');
  });

  it('keeps an explicit custom endpoint only in compatible mode', () => {
    expect(resolveProviderBaseURL('anthropic-compatible', ' https://gateway.example/v1/ ')).toBe(
      'https://gateway.example/v1'
    );
    expect(resolveProviderBaseURL('anthropic-compatible')).toBe('https://api.z.ai/api/anthropic');
  });

  it('rejects unknown provider identifiers', () => {
    expect(isProvider('openai')).toBe(true);
    expect(isProvider('unknown')).toBe(false);
    expect(isProvider({})).toBe(false);
  });

  it('never carries a stale endpoint across provider switches', () => {
    expect(
      resolveSettingsBaseURL('anthropic-compatible', 'openai', 'https://gateway.example/v1', undefined)
    ).toBeUndefined();
    expect(resolveSettingsBaseURL('glm', 'anthropic-compatible', 'https://api.z.ai/api/paas/v4', undefined)).toBe(
      'https://api.z.ai/api/anthropic'
    );
  });

  it('preserves a custom compatible endpoint on unrelated settings updates', () => {
    expect(
      resolveSettingsBaseURL('anthropic-compatible', 'anthropic-compatible', 'https://gateway.example/v1', undefined)
    ).toBe('https://gateway.example/v1');
  });
});
