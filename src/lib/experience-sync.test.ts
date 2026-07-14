import { describe, expect, it, vi } from 'vitest';
import type { ExperienceEnvelope } from '@/types';
import { draftDivergenceAfterPublication, draftPublicationConfirmed, draftPublicationIsStale, reconcileDraft, watchExperienceWithReconnect } from './experience-sync';

function envelope(revision: number, draft: string): ExperienceEnvelope {
  return {
    id: 'primary', revision, composer_draft: draft,
    model_route: {},
    pending_questions: [], pending_permissions: [],
    active: { project_id: null, session_id: null, run_id: null },
    transcript_cursor: 0, transcript_epoch: null, last_event_id: String(revision),
    selected_view: '', selected_artifact_id: null, surfaces: {},
  };
}

describe('experience synchronization', () => {
  it('preserves and exposes a dirty local draft when a different remote draft arrives', () => {
    expect(reconcileDraft('local work', 'previous', 'remote work')).toEqual({
      mode: 'diverged', local: 'local work', remote: 'remote work',
    });
    expect(reconcileDraft('previous', 'previous', 'remote work')).toEqual({
      mode: 'accept-remote', value: 'remote work',
    });
    expect(draftPublicationIsStale(7, 8)).toBe(true);
    expect(draftPublicationIsStale(8, 8)).toBe(false);
    expect(draftPublicationConfirmed('local work', 'remote work')).toBe(false);
    expect(draftPublicationConfirmed('local work', 'local work')).toBe(true);
  });

  it('keeps local divergence visible until the exact draft publication succeeds', () => {
    const divergence = { local: 'local work', remote: 'remote work' };
    expect(draftDivergenceAfterPublication(divergence, 'local work', false)).toBe(divergence);
    expect(draftDivergenceAfterPublication(divergence, 'older local', true)).toBe(divergence);
    expect(draftDivergenceAfterPublication(divergence, 'local work', true)).toBeNull();
  });

  it('restores fresh state before reconnecting and bounds consecutive failures', async () => {
    const controller = new AbortController();
    const apply = vi.fn(async (value: ExperienceEnvelope) => {
      if (value.revision === 3) controller.abort();
    });
    let calls = 0;
    const watch = vi.fn(async (onEnvelope: (value: ExperienceEnvelope) => void | Promise<void>) => {
      calls += 1;
      if (calls === 1) throw new Error('dropped');
      await onEnvelope(envelope(3, 'reconnected'));
    });
    const restore = vi.fn(async () => envelope(2, 'fresh'));

    await watchExperienceWithReconnect({
      watch, restore, apply, signal: controller.signal,
      lastEventId: () => '1', delaysMs: [0], maxConsecutiveFailures: 2,
    });

    expect(restore).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls.map(([value]) => value.revision)).toEqual([2, 3]);
    expect(watch).toHaveBeenCalledTimes(2);
  });

  it('stops after the configured consecutive reconnect failures', async () => {
    const watch = vi.fn(async () => { throw new Error('offline'); });
    const restore = vi.fn(async () => envelope(2, 'fresh'));
    await expect(watchExperienceWithReconnect({
      watch, restore, apply: vi.fn(), signal: new AbortController().signal,
      lastEventId: () => '1', delaysMs: [0], maxConsecutiveFailures: 2,
    })).rejects.toThrow('offline');
    expect(watch).toHaveBeenCalledTimes(3);
    expect(restore).toHaveBeenCalledTimes(2);
  });
});
