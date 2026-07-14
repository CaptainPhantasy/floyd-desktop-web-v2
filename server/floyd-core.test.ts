import { describe, expect, it } from 'vitest';
import { FloydApiError, FloydCoreBridge } from './floyd-core.js';

describe('FloydCoreBridge', () => {
  it('selects the Core project by exact root and keeps the gateway token server-side', async () => {
    const seen: Array<{ url: string; authorization: string | null }> = [];
    const bridge = new FloydCoreBridge({
      baseUrl: 'http://127.0.0.1:41414',
      token: 'private-loopback-token',
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        seen.push({ url: String(input), authorization: headers.get('authorization') });
        return new Response(JSON.stringify({ projects: [{ id: 'project-1', name: 'copy', root_path: '/copy' }] }), { status: 200 });
      },
    });

    await expect(bridge.resolveProject('/copy')).resolves.toBe('project-1');
    expect(seen).toEqual([{ url: 'http://127.0.0.1:41414/api/state', authorization: 'Bearer private-loopback-token' }]);
  });

  it('preserves Core status and payload instead of manufacturing a 500', async () => {
    const bridge = new FloydCoreBridge({
      token: 'token',
      fetch: async () => new Response(JSON.stringify({ error: 'rate limited', request_id: 'req-7' }), { status: 429 }),
    });

    try {
      await bridge.resolveProject('/copy');
      throw new Error('expected resolveProject to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(FloydApiError);
      expect((error as FloydApiError).status).toBe(429);
      expect((error as FloydApiError).payload).toEqual({ error: 'rate limited', request_id: 'req-7' });
    }
  });

  it('cancels the Core response reader when the consumer stops streaming', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: token\ndata: {"data":{"delta":"x"}}\n\n'));
      },
      cancel() { cancelled = true; },
    });
    const bridge = new FloydCoreBridge({
      token: 'token',
      fetch: async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    });

    const events = bridge.client.attachSession('session-1', 'desktop');
    await expect(events.next()).resolves.toMatchObject({ value: { type: 'token' }, done: false });
    await events.return(undefined);
    expect(cancelled).toBe(true);
  });
});
