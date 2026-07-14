import { describe, expect, it, vi } from 'vitest';
import type { ExperienceEnvelope, FloydStreamEvent } from '@floyd/sdk';
import { attachRunWithReconnect, IncompleteCoreStreamError } from './core-stream';

function envelope(lastEventId = '1'): ExperienceEnvelope {
  return {
    id: 'primary', schema_version: '1', revision: 2,
    active: { project_id: 'project-1', session_id: 'session-1', run_id: 'run-1' },
    model_route: {}, transcript_cursor: 1, transcript_epoch: 'epoch-1', last_event_id: lastEventId,
    pending_questions: [], pending_permissions: [], composer_draft: '', selected_artifact_id: null,
    selected_view: 'desktop-chat', surfaces: { desktop: { last_event_id: lastEventId } },
    updated_at: '', updated_by_device_id: null,
  };
}

async function* events(values: FloydStreamEvent[]): AsyncGenerator<FloydStreamEvent> {
  for (const value of values) yield value;
}

describe('Core coding stream reconnect', () => {
  it('restores, resumes the exact run cursor, and deduplicates replay before done', async () => {
    const attachSession = vi.fn()
      .mockImplementationOnce(() => events([{ id: '1', type: 'token', data: { data: { delta: 'hel' } } }]))
      .mockImplementationOnce(() => events([
        { id: '1', type: 'token', data: { data: { delta: 'hel' } } },
        { id: '2', type: 'token', data: { data: { delta: 'lo' } } },
        { id: '3', type: 'done', data: {} },
      ]));
    const experience = vi.fn(async () => envelope('2'));
    const received: string[] = [];

    await attachRunWithReconnect({
      client: { attachSession, experience } as never,
      binding: { sessionId: 'session-1', runId: 'run-1' },
      signal: new AbortController().signal,
      delaysMs: [0],
      onEvent: (event) => { received.push(String(event.id)); },
    });

    expect(received).toEqual(['1', '2', '3']);
    expect(experience).toHaveBeenCalledTimes(1);
    expect(attachSession).toHaveBeenNthCalledWith(2, 'session-1', 'floyd-desktop', expect.objectContaining({
      runId: 'run-1', lastEventId: '1',
    }));
  });

  it('never converts repeated EOF into semantic completion', async () => {
    const attachSession = vi.fn(() => events([]));
    await expect(attachRunWithReconnect({
      client: { attachSession, experience: vi.fn(async () => envelope()) } as never,
      binding: { sessionId: 'session-1', runId: 'run-1' },
      signal: new AbortController().signal,
      delaysMs: [0], maxReconnects: 2, onEvent: vi.fn(),
    })).rejects.toBeInstanceOf(IncompleteCoreStreamError);
    expect(attachSession).toHaveBeenCalledTimes(3);
  });

  it('uses a freshly restored cursor when the dropped attach delivered no event', async () => {
    const attachSession = vi.fn()
      .mockImplementationOnce(() => events([]))
      .mockImplementationOnce(() => events([{ id: '8', type: 'done', data: {} }]));
    await attachRunWithReconnect({
      client: { attachSession, experience: vi.fn(async () => envelope('7')) } as never,
      binding: { sessionId: 'session-1', runId: 'run-1' }, signal: new AbortController().signal,
      delaysMs: [0], onEvent: vi.fn(),
    });
    expect(attachSession).toHaveBeenNthCalledWith(2, 'session-1', 'floyd-desktop', expect.objectContaining({ lastEventId: '7', runId: 'run-1' }));
  });

  it('stops reconnecting as soon as the browser aborts', async () => {
    const controller = new AbortController();
    const attachSession = vi.fn(() => events([]));
    const experience = vi.fn(async () => envelope());
    const promise = attachRunWithReconnect({
      client: { attachSession, experience } as never,
      binding: { sessionId: 'session-1', runId: 'run-1' },
      signal: controller.signal, delaysMs: [10_000], onEvent: vi.fn(),
    });
    controller.abort();
    await promise;
    expect(attachSession).toHaveBeenCalledTimes(1);
    expect(experience).not.toHaveBeenCalled();
  });
});
