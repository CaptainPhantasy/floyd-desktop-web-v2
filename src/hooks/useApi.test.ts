import { describe, expect, it } from 'vitest';
import { parseSse } from './useApi';

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
