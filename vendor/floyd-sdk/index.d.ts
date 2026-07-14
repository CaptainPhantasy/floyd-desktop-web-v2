export const DEFAULT_FLOYD_CORE_URL: string;

export interface FloydClientOptions {
  baseUrl?: string;
  token: string | (() => string | Promise<string>);
  fetch?: typeof globalThis.fetch;
}

export interface FloydStreamEvent<T = unknown> {
  id?: string;
  type: string;
  data: T;
}

export class FloydApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly payload: unknown;
}

export class FloydClient {
  readonly baseUrl: string;
  constructor(options: FloydClientOptions);
  health(signal?: AbortSignal): Promise<Record<string, unknown>>;
  state(signal?: AbortSignal): Promise<{ projects: Array<{ id: string; name: string; root_path: string }> }>;
  submit(projectId: string, goal: string, signal?: AbortSignal): Promise<{ run_id: string; duplicate: boolean }>;
  run(runId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  steer(sessionId: string, text: string, actor: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  attachSession(sessionId: string, actor: string, options?: { lastEventId?: string; signal?: AbortSignal }): AsyncGenerator<FloydStreamEvent>;
}
