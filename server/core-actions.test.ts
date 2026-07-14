import { createServer, get, type Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloydApiError } from './floyd-core.js';
import { registerCoreActionRoutes } from './core-actions.js';

const servers: Server[] = [];

async function surface(client: Record<string, unknown>): Promise<string> {
  const app = express();
  app.use(express.json());
  registerCoreActionRoutes(app, { client } as never);
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing address');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));

describe('Desktop Core action routes', () => {
  it('keeps replies run-scoped and the token-side client server-side', async () => {
    const client = { artifactById: vi.fn(async () => 'diff text'), answer: vi.fn(async () => ({ accepted: true })), permission: vi.fn(async () => ({ accepted: true })) };
    const base = await surface(client);
    expect(await (await fetch(`${base}/api/core/artifacts/art-1`)).text()).toBe('diff text');
    await fetch(`${base}/api/core/sessions/session-1/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId: 'run-1', requestId: 'q-1', answers: [['yes']] }) });
    await fetch(`${base}/api/core/sessions/session-1/permission`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId: 'run-1', requestId: 'p-1', reply: 'always' }) });
    expect(client.answer).toHaveBeenCalledWith('session-1', 'q-1', [['yes']], 'floyd-desktop', expect.any(AbortSignal), 'run-1');
    expect(client.permission).toHaveBeenCalledWith('session-1', 'p-1', 'always', 'floyd-desktop', expect.any(AbortSignal), 'run-1');
  });

  it('preserves exact upstream status and text error payload', async () => {
    const client = { artifactById: vi.fn(async () => { throw new FloydApiError('GET', '/api/artifacts/missing', 404, 'exact missing artifact'); }) };
    const base = await surface(client);
    const response = await fetch(`${base}/api/core/artifacts/missing`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('exact missing artifact');
  });

  it('aborts the Core artifact request when the browser disconnects', async () => {
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    let aborted = false;
    const client = { artifactById: vi.fn((_id: string, signal: AbortSignal) => new Promise((_resolve, reject) => {
      entered();
      signal.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });
    })) };
    const base = await surface(client);
    const request = get(`${base}/api/core/artifacts/slow`);
    request.on('error', () => {});
    await started;
    request.destroy();
    const deadline = Date.now() + 1_000;
    while (!aborted && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(aborted).toBe(true);
  });
});
