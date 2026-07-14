import type { ExperienceEnvelope } from '@/types';

export type DraftReconciliation =
  | { mode: 'accept-remote'; value: string }
  | { mode: 'synced'; value: string }
  | { mode: 'diverged'; local: string; remote: string };

export interface DraftDivergence {
  local: string;
  remote: string;
}

/** Preserve locally edited text whenever Core advances to a different draft. */
export function reconcileDraft(local: string, lastSynced: string, remote: string): DraftReconciliation {
  if (local === remote) return { mode: 'synced', value: remote };
  if (local !== lastSynced) return { mode: 'diverged', local, remote };
  return { mode: 'accept-remote', value: remote };
}

export function draftPublicationIsStale(queuedRevision: number | undefined, currentRevision: number): boolean {
  return queuedRevision !== undefined && queuedRevision !== currentRevision;
}

export function draftPublicationConfirmed(requestedDraft: string | undefined, publishedDraft: string): boolean {
  return requestedDraft === undefined || publishedDraft === requestedDraft;
}

/** Keep the resolution visible unless the exact local draft was published. */
export function draftDivergenceAfterPublication(
  current: DraftDivergence | null,
  attemptedLocal: string,
  published: boolean,
): DraftDivergence | null {
  if (!published || current?.local !== attemptedLocal) return current;
  return null;
}

interface WatchLoopOptions {
  watch: (
    onEnvelope: (envelope: ExperienceEnvelope) => void | Promise<void>,
    signal: AbortSignal,
    lastEventId?: string,
  ) => Promise<void>;
  restore: (signal: AbortSignal) => Promise<ExperienceEnvelope>;
  apply: (envelope: ExperienceEnvelope, force?: boolean) => void | Promise<void>;
  lastEventId: () => string | undefined;
  signal: AbortSignal;
  onRetry?: (attempt: number, error: unknown) => void;
  maxConsecutiveFailures?: number;
  delaysMs?: number[];
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/**
 * Keep the experience stream alive across bounded consecutive failures. Every
 * reconnect first fetches a fresh envelope so missed state is restored before
 * a new stream cursor is opened.
 */
export async function watchExperienceWithReconnect(options: WatchLoopOptions): Promise<void> {
  const maxFailures = options.maxConsecutiveFailures ?? 5;
  const delays = options.delaysMs ?? [250, 500, 1_000, 2_000, 5_000];
  let failures = 0;
  let restoreBeforeWatch = false;

  while (!options.signal.aborted) {
    try {
      if (restoreBeforeWatch) {
        const envelope = await options.restore(options.signal);
        if (options.signal.aborted) return;
        await options.apply(envelope, true);
      }
      await options.watch(async (envelope) => {
        failures = 0;
        await options.apply(envelope);
      }, options.signal, options.lastEventId());
      if (options.signal.aborted) return;
      throw new Error('Experience stream ended');
    } catch (error) {
      if (options.signal.aborted) return;
      failures += 1;
      if (failures > maxFailures) throw error;
      options.onRetry?.(failures, error);
      await abortableDelay(delays[Math.min(failures - 1, delays.length - 1)] ?? 5_000, options.signal);
      restoreBeforeWatch = true;
    }
  }
}
