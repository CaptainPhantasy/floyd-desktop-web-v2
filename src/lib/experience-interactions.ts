export interface QuestionPrompt {
  text: string;
  options: string[];
}

export interface PendingQuestion {
  requestId: string;
  prompts: QuestionPrompt[];
}

export interface PendingPermission {
  requestId: string;
  title: string;
  detail: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  if (!value || typeof value !== 'object') return value == null ? '' : String(value);
  const valueRecord = record(value);
  return text(valueRecord.label ?? valueRecord.description ?? valueRecord.text ?? valueRecord.name);
}

function payload(item: unknown): Record<string, unknown> {
  const outer = record(item);
  return { ...outer, ...record(outer.data) };
}

function requestId(item: unknown): string {
  const value = payload(item);
  return text(value.request_id ?? value.id ?? value.question_id ?? value.permission_id);
}

export function normalizePendingQuestions(items: unknown[]): PendingQuestion[] {
  return items.flatMap((item) => {
    const value = payload(item);
    const id = requestId(item);
    if (!id) return [];
    const rawQuestions = Array.isArray(value.questions) ? value.questions : [value];
    const prompts = rawQuestions.map((raw, index) => {
      const question = record(raw);
      const options = Array.isArray(question.options) ? question.options.map(text).filter(Boolean) : [];
      return {
        text: text(question.question ?? question.prompt ?? question.text ?? question.header) || `Question ${index + 1}`,
        options,
      };
    });
    return [{ requestId: id, prompts }];
  });
}

export function normalizePendingPermissions(items: unknown[]): PendingPermission[] {
  return items.flatMap((item) => {
    const value = payload(item);
    const id = requestId(item);
    if (!id) return [];
    const title = text(value.permission ?? value.kind ?? value.title ?? value.type) || 'Permission request';
    const detail = text(value.patterns ?? value.path ?? value.command ?? value.description ?? value.metadata);
    return [{ requestId: id, title, detail }];
  });
}

export function readableArtifact(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return JSON.stringify(value, null, 2);
}

/** Intentionally reads only public route metadata; credential_ref is ignored. */
export function modelRouteLabel(route: Record<string, unknown> | null | undefined): string {
  const provider = typeof route?.provider === 'string' ? route.provider.trim() : '';
  const model = typeof route?.model === 'string' ? route.model.trim() : '';
  if (provider && model) return `${provider} / ${model}`;
  return provider || model || 'Core default';
}
