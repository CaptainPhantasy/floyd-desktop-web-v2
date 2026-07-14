import type { Express, Request, Response } from 'express';
import { FloydApiError, FloydCoreBridge } from './floyd-core.js';

const ACTOR = 'floyd-desktop';

function isLoopback(address?: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function sendPayload(res: Response, status: number, payload: unknown): void {
  if (typeof payload === 'string') res.status(status).type('text/plain').send(payload);
  else res.status(status).json(payload);
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof FloydApiError) sendPayload(res, error.status, error.payload);
  else sendPayload(res, 503, { error: error instanceof Error ? error.message : String(error) });
}

async function withAbort(req: Request, res: Response, action: (signal: AbortSignal) => Promise<unknown>): Promise<void> {
  if (!isLoopback(req.socket.remoteAddress)) {
    res.status(403).json({ error: 'Core action routes are loopback-only' });
    return;
  }
  const abort = new AbortController();
  const cancel = () => abort.abort();
  const cancelOnClose = () => { if (!res.writableEnded) abort.abort(); };
  req.once('aborted', cancel);
  res.once('close', cancelOnClose);
  try {
    sendPayload(res, 200, await action(abort.signal));
  } catch (error) {
    if (!abort.signal.aborted && !res.writableEnded) sendError(res, error);
  } finally {
    req.off('aborted', cancel);
    res.off('close', cancelOnClose);
  }
}

export function registerCoreActionRoutes(app: Express, bridge: FloydCoreBridge): void {
  app.get('/api/core/artifacts/:artifactId', (req, res) => withAbort(
    req, res, (signal) => bridge.client.artifactById(req.params.artifactId, signal),
  ));

  app.post('/api/core/sessions/:sessionId/answer', (req, res) => {
    const { runId, requestId, answers } = req.body as { runId?: string; requestId?: string; answers?: string[][] };
    if (!runId || !requestId || !Array.isArray(answers) || answers.some((answer) => !Array.isArray(answer))) {
      res.status(400).json({ error: 'runId, requestId and answers are required' });
      return;
    }
    return withAbort(req, res, (signal) => bridge.client.answer(
      req.params.sessionId, requestId, answers, ACTOR, signal, runId,
    ));
  });

  app.post('/api/core/sessions/:sessionId/permission', (req, res) => {
    const { runId, requestId, reply } = req.body as { runId?: string; requestId?: string; reply?: 'once' | 'always' | 'reject' };
    if (!runId || !requestId || !['once', 'always', 'reject'].includes(reply ?? '')) {
      res.status(400).json({ error: 'runId, requestId and a valid reply are required' });
      return;
    }
    return withAbort(req, res, (signal) => bridge.client.permission(
      req.params.sessionId, requestId, reply!, ACTOR, signal, runId,
    ));
  });
}
