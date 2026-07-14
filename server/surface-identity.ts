export interface DesktopSurfaceIdentity {
  identity: {
    surface_id: 'desktop';
    source_root: string;
    source_commit: string;
  };
}

/**
 * Attach runtime provenance without making the source tree claim its own
 * commit. Admission supplies FLOYD_SURFACE_COMMIT; an absent or blank value is
 * intentionally visible as unverified rather than inferred from Git.
 */
export function withDesktopSurfaceIdentity<T extends Record<string, unknown>>(payload: T): T & DesktopSurfaceIdentity {
  return {
    ...payload,
    identity: {
      surface_id: 'desktop',
      source_root: process.cwd(),
      source_commit: process.env.FLOYD_SURFACE_COMMIT?.trim() || 'unverified',
    },
  };
}
