import type { Express, Request, Response } from 'express';
import { FloydApiError, FloydCoreBridge } from './floyd-core.js';

const SURFACE_ID = 'desktop';
const SDK_VERSION = '1.0.0';
const CAPABILITIES = ['coding-runs', 'drafts', 'experience-stream', 'transcript-restore'];

function isLoopback(address?: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function localOnly(req: Request, res: Response): boolean {
  if (isLoopback(req.socket.remoteAddress)) return true;
  res.status(403).json({ error: 'experience routes are loopback-only' });
  return false;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof FloydApiError) {
    res.status(error.status).json(error.payload);
    return;
  }
  res.status(503).json({ error: error instanceof Error ? error.message : String(error) });
}

async function relaySse(
  req: Request,
  res: Response,
  create: (signal: AbortSignal) => AsyncGenerator<{ id?: string; type: string; data: unknown }>,
): Promise<void> {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  req.once('aborted', cancel);
  res.once('close', cancel);
  const events = create(abort.signal);
  try {
    // Prime before committing HTTP 200 so Core's exact 4xx/5xx remains visible.
    let next = await events.next();
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    while (!next.done && !abort.signal.aborted) {
      const event = next.value;
      if (event.id) res.write(`id: ${event.id}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
      next = await events.next();
    }
    if (!res.writableEnded) res.end();
  } catch (error) {
    if (abort.signal.aborted || res.writableEnded) return;
    if (!res.headersSent) sendError(res, error);
    else {
      const detail = error instanceof FloydApiError
        ? { status: error.status, payload: error.payload }
        : { message: error instanceof Error ? error.message : String(error) };
      res.write(`event: error\ndata: ${JSON.stringify(detail)}\n\n`);
      res.end();
    }
  } finally {
    await events.return(undefined).catch(() => {});
    req.off('aborted', cancel);
    res.off('close', cancel);
  }
}

export function registerExperienceRoutes(app: Express, bridge: FloydCoreBridge): void {
  app.post('/api/core/experience/negotiate', async (req, res) => {
    if (!localOnly(req, res)) return;
    const abort = new AbortController();
    req.once('aborted', () => abort.abort());
    try {
      res.json(await bridge.client.negotiateExperience({
        surface_id: SURFACE_ID,
        sdk_version: SDK_VERSION,
        supported_envelope_versions: [SDK_VERSION],
        capabilities: CAPABILITIES,
      }, abort.signal));
    } catch (error) { sendError(res, error); }
  });

  app.get('/api/core/experience/:id', async (req, res) => {
    if (!localOnly(req, res)) return;
    const abort = new AbortController();
    req.once('aborted', () => abort.abort());
    try { res.json(await bridge.client.experience(req.params.id, abort.signal)); }
    catch (error) { sendError(res, error); }
  });

  app.patch('/api/core/experience/:id', async (req, res) => {
    if (!localOnly(req, res)) return;
    const abort = new AbortController();
    req.once('aborted', () => abort.abort());
    try { res.json(await bridge.client.updateExperience(req.params.id, req.body, abort.signal)); }
    catch (error) { sendError(res, error); }
  });

  app.get('/api/core/experience/:id/stream', async (req, res) => {
    if (!localOnly(req, res)) return;
    await relaySse(req, res, (signal) => bridge.client.watchExperience(req.params.id, {
      lastEventId: typeof req.headers['last-event-id'] === 'string' ? req.headers['last-event-id'] : undefined,
      signal,
    }));
  });

  app.get('/api/core/sessions/:id/attach', async (req, res) => {
    if (!localOnly(req, res)) return;
    const runId = typeof req.query.run_id === 'string' ? req.query.run_id : undefined;
    const lastEventId = typeof req.headers['last-event-id'] === 'string' ? req.headers['last-event-id'] : undefined;
    await relaySse(req, res, (signal) => bridge.client.attachSession(req.params.id, SURFACE_ID, {
      runId,
      lastEventId,
      signal,
    }));
  });
}
