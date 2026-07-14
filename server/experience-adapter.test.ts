import { createServer, get, type Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { FloydCoreBridge } from './floyd-core.js';
import { registerExperienceRoutes } from './experience-adapter.js';

const servers: Server[] = [];

async function surface(fetchImpl: typeof fetch): Promise<string> {
  const app = express();
  app.use(express.json());
  registerExperienceRoutes(app, new FloydCoreBridge({ token: 'private-token', fetch: fetchImpl }));
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test address');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('desktop experience adapter', () => {
  it('keeps authorization server-side and preserves negotiation 426 and publish 409', async () => {
    const seen: Array<{ path: string; authorization: string | null; body: unknown }> = [];
    const base = await surface(async (input, init) => {
      const request = new Request(input, init);
      seen.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
        body: request.method === 'GET' ? null : await request.clone().json(),
      });
      if (request.method === 'POST') return Response.json({ error: 'sdk_upgrade_required' }, { status: 426 });
      return Response.json({ error: 'revision_conflict', envelope: { revision: 8 } }, { status: 409 });
    });

    const negotiate = await fetch(`${base}/api/core/experience/negotiate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(negotiate.status).toBe(426);
    expect(await negotiate.json()).toEqual({ error: 'sdk_upgrade_required' });

    const publish = await fetch(`${base}/api/core/experience/primary`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expected_revision: 7 }) });
    expect(publish.status).toBe(409);
    expect(await publish.json()).toEqual({ error: 'revision_conflict', envelope: { revision: 8 } });
    expect(seen.map((item) => item.authorization)).toEqual(['Bearer private-token', 'Bearer private-token']);
    expect(seen[0]?.body).toMatchObject({ surface_id: 'desktop', supported_envelope_versions: ['1.0.0'] });
    expect(seen[0]?.body).toMatchObject({ capabilities: expect.arrayContaining([
      'artifacts', 'model-route-display', 'permissions', 'questions', 'selected-view',
    ]) });
  });

  it('relays the durable transcript snapshot and cancels Core when the browser stops reading', async () => {
    let upstreamAborted = false;
    const base = await surface(async (_input, init) => {
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('id: 4\nevent: transcript\ndata: {"messages":[{"role":"user","content":"resume"}]}\n\n'));
          init?.signal?.addEventListener('abort', () => {
            upstreamAborted = true;
            controller.error(new DOMException('aborted', 'AbortError'));
          }, { once: true });
        },
      }), { headers: { 'content-type': 'text/event-stream' } });
    });

    await new Promise<void>((resolve, reject) => {
      const request = get(`${base}/api/core/sessions/session-1/attach?run_id=run-1`, (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += String(chunk);
          if (!body.includes('event: transcript')) return;
          try {
            expect(response.statusCode).toBe(200);
            response.socket.destroy();
            response.destroy();
            request.destroy();
            resolve();
          } catch (error) { reject(error); }
        });
      });
      request.once('error', reject);
    });
    const deadline = Date.now() + 1_000;
    while (!upstreamAborted && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(upstreamAborted).toBe(true);
  });
});
