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

export interface ExperienceEnvelope {
  id: string;
  schema_version: string;
  revision: number;
  active: { project_id: string | null; session_id: string | null; run_id: string | null };
  model_route: Record<string, unknown>;
  transcript_cursor: number;
  transcript_epoch: string | null;
  last_event_id: string | null;
  pending_questions: unknown[];
  pending_permissions: unknown[];
  composer_draft: string;
  selected_artifact_id: string | null;
  selected_view: string;
  surfaces: Record<string, Record<string, unknown>>;
  updated_at: string;
  updated_by_device_id: string | null;
}

export class FloydApiError extends Error {
  constructor(method: string, path: string, status: number, payload: unknown);
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
  negotiateExperience(input: { surface_id: string; sdk_version: string; supported_envelope_versions: string[]; capabilities: string[] }, signal?: AbortSignal): Promise<Record<string, unknown>>;
  experience(envelopeId?: string, signal?: AbortSignal): Promise<ExperienceEnvelope>;
  updateExperience(envelopeId: string, patch: Record<string, unknown>, signal?: AbortSignal): Promise<ExperienceEnvelope>;
  watchExperience(envelopeId?: string, options?: { lastEventId?: string; signal?: AbortSignal }): AsyncGenerator<FloydStreamEvent<ExperienceEnvelope>>;
  submit(projectId: string, goal: string, signal?: AbortSignal): Promise<{ run_id: string; duplicate: boolean }>;
  run(runId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  artifactById(artifactId: string, signal?: AbortSignal): Promise<unknown>;
  steer(sessionId: string, text: string, actor: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
  answer(sessionId: string, requestId: string, answers: string[][], actor: string, signal?: AbortSignal, runId?: string): Promise<Record<string, unknown>>;
  permission(sessionId: string, requestId: string, reply: "once" | "always" | "reject", actor: string, signal?: AbortSignal, runId?: string): Promise<Record<string, unknown>>;
  attachSession(sessionId: string, actor: string, options?: { lastEventId?: string; signal?: AbortSignal; runId?: string }): AsyncGenerator<FloydStreamEvent>;
}
