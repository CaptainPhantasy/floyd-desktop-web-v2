import { afterEach, describe, expect, it, vi } from 'vitest';
import { withDesktopSurfaceIdentity } from './surface-identity';

afterEach(() => vi.unstubAllEnvs());

describe('Desktop admitted provenance identity', () => {
  it('merges the runtime source root and admitted commit into existing health', () => {
    vi.stubEnv('FLOYD_SURFACE_COMMIT', ' admitted-commit-123 ');

    expect(withDesktopSurfaceIdentity({
      status: 'ok', hasApiKey: false, provider: 'core', model: 'floyd',
    })).toEqual({
      status: 'ok', hasApiKey: false, provider: 'core', model: 'floyd',
      identity: {
        surface_id: 'desktop',
        source_root: process.cwd(),
        source_commit: 'admitted-commit-123',
      },
    });
  });

  it.each([undefined, '', '   '])('reports %s runtime commit as unverified', (value) => {
    if (value === undefined) vi.stubEnv('FLOYD_SURFACE_COMMIT', undefined);
    else vi.stubEnv('FLOYD_SURFACE_COMMIT', value);

    expect(withDesktopSurfaceIdentity({ status: 'ok' }).identity).toEqual({
      surface_id: 'desktop',
      source_root: process.cwd(),
      source_commit: 'unverified',
    });
  });
});
