import type { ExperienceEnvelope, FloydClient, FloydStreamEvent } from '@floyd/sdk';

export interface CoreRunBinding {
  sessionId: string;
  runId: string;
}

interface AttachRunOptions {
  client: Pick<FloydClient, 'attachSession' | 'experience'>;
  binding: CoreRunBinding;
  signal: AbortSignal;
  onEvent: (event: FloydStreamEvent) => void | Promise<void>;
  onRestore?: (envelope: ExperienceEnvelope) => void | Promise<void>;
  maxReconnects?: number;
  delaysMs?: number[];
}

export class IncompleteCoreStreamError extends Error {
  constructor(readonly reconnects: number, readonly lastEventId?: string) {
    super(`Core attach ended before done after ${reconnects} reconnect${reconnects === 1 ? '' : 's'}`);
    this.name = 'IncompleteCoreStreamError';
  }
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function restoredCursor(envelope: ExperienceEnvelope, binding: CoreRunBinding): string | undefined {
  if (envelope.active.session_id !== binding.sessionId || envelope.active.run_id !== binding.runId) return undefined;
  const desktop = envelope.surfaces?.desktop;
  const cursor = desktop?.last_event_id ?? envelope.last_event_id;
  return typeof cursor === 'string' && cursor ? cursor : undefined;
}

/**
 * Supervise one semantic Core run across transient attach disconnects.
 *
 * A clean transport EOF is not semantic completion: only an explicit `done`
 * event completes the run. Reconnects keep the exact session/run binding and
 * last acknowledged event ID. A fresh experience snapshot is restored before
 * each retry, while replayed event IDs are suppressed before reaching callers.
 */
export async function attachRunWithReconnect(options: AttachRunOptions): Promise<void> {
  const maxReconnects = options.maxReconnects ?? 5;
  const delays = options.delaysMs ?? [100, 250, 500, 1_000, 2_000];
  const seenEventIds = new Set<string>();
  const eventIdOrder: string[] = [];
  let lastEventId: string | undefined;
  let reconnects = 0;

  while (!options.signal.aborted) {
    let callbackFailed = false;
    try {
      for await (const event of options.client.attachSession(options.binding.sessionId, 'floyd-desktop', {
        runId: options.binding.runId,
        lastEventId,
        signal: options.signal,
      })) {
        if (options.signal.aborted) return;
        if (event.id) {
          lastEventId = event.id;
          if (seenEventIds.has(event.id)) continue;
          seenEventIds.add(event.id);
          eventIdOrder.push(event.id);
          if (eventIdOrder.length > 4_096) seenEventIds.delete(eventIdOrder.shift()!);
        }
        try {
          await options.onEvent(event);
        } catch (error) {
          callbackFailed = true;
          throw error;
        }
        if (event.type === 'done') return;
      }
    } catch (error) {
      if (options.signal.aborted) return;
      if (callbackFailed) throw error;
      if (reconnects >= maxReconnects) throw error;
    }

    if (options.signal.aborted) return;
    if (reconnects >= maxReconnects) throw new IncompleteCoreStreamError(reconnects, lastEventId);
    reconnects += 1;
    await abortableDelay(delays[Math.min(reconnects - 1, delays.length - 1)] ?? 2_000, options.signal);
    if (options.signal.aborted) return;

    const envelope = await options.client.experience('primary', options.signal);
    if (options.signal.aborted) return;
    await options.onRestore?.(envelope);
    lastEventId ??= restoredCursor(envelope, options.binding);
  }
}
