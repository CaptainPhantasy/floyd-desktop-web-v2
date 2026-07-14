import { describe, expect, it, vi } from 'vitest';
import { consumeCodingStream, parseSse } from './useApi';

describe('SSE parsing', () => {
  it('preserves a JSON event split across every TCP chunk boundary', async () => {
    const bytes = new TextEncoder().encode('data: {"type":"text","content":"split safely"}\r\n\r\ndata: {"type":"done","sessionId":"s1"}\r\n\r\n');
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }));

    const events = [];
    for await (const event of parseSse(response)) events.push(event.data);
    expect(events).toEqual([
      { type: 'text', content: 'split safely' },
      { type: 'done', sessionId: 's1' },
    ]);
  });
});

describe('coding stream lifecycle', () => {
  const response = (body: string) => new Response(body, { headers: { 'content-type': 'text/event-stream' } });

  it('rejects partial transport EOF instead of manufacturing completion', async () => {
    const onDone = vi.fn();
    const onText = vi.fn();
    await expect(consumeCodingStream(response('data: {"type":"text","content":"partial"}\n\n'), {
      onText, onDone,
    })).rejects.toThrow('before Floyd Core reported completion');
    expect(onText).toHaveBeenCalledWith('partial');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('completes exactly once only after an explicit done event', async () => {
    const onDone = vi.fn();
    await consumeCodingStream(response('data: {"type":"done","sessionId":"desktop-1","runId":"run-1","coreSessionId":"core-1"}\n\n'), {
      onText: vi.fn(), onDone,
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(undefined, 'desktop-1', expect.objectContaining({ floydRunId: 'run-1', floydSessionId: 'core-1' }));
  });
});
