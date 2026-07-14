/**
 * API hooks for Floyd Web
 */

import { useState, useCallback } from 'react';
import type { ExperienceEnvelope, Message, Session, Settings } from '@/types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(readonly status: number, readonly payload: unknown) {
    super(typeof payload === 'object' && payload && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : `HTTP ${status}`);
  }
}

async function responsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return text; }
}

export async function* parseSse(response: Response): AsyncGenerator<{ id?: string; type: string; data: any }> {
  if (!response.ok) throw new ApiError(response.status, await responsePayload(response));
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
        if (!boundary || boundary.index === undefined) break;
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        let id: string | undefined;
        let type = 'message';
        const lines: string[] = [];
        for (const line of frame.split(/\r\n|\n|\r/)) {
          if (line.startsWith('id:')) id = line.slice(3).trim();
          else if (line.startsWith('event:')) type = line.slice(6).trim();
          else if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
        }
        if (!lines.length) continue;
        const raw = lines.join('\n');
        let data: any = raw;
        try { data = JSON.parse(raw); } catch { /* valid text event */ }
        yield { ...(id ? { id } : {}), type, data };
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function transcriptText(value: any): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(transcriptText).filter(Boolean).join('\n');
  if (!value || typeof value !== 'object') return '';
  return transcriptText(value.text ?? value.content ?? value.parts ?? value.data);
}

function transcriptMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return [...value]
    .sort((a: any, b: any) => Number(a?.time?.created ?? a?.info?.time?.created ?? 0) - Number(b?.time?.created ?? b?.info?.time?.created ?? 0))
    .map((item: any) => {
      const role = item?.role ?? item?.type ?? item?.info?.role ?? item?.info?.type;
      const content = transcriptText(item?.content ?? item?.parts ?? item?.data);
      return content && (role === 'user' || role === 'assistant') ? { role, content } as Message : null;
    })
    .filter((item): item is Message => item !== null);
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJson = useCallback(async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new ApiError(response.status, await responsePayload(response));
    }
    
    return response.json();
  }, []);

  // Health check
  const checkHealth = useCallback(async () => {
    return fetchJson<{ status: string; hasApiKey: boolean; model: string }>('/core/health');
  }, [fetchJson]);

  // Settings
  const getSettings = useCallback(async () => {
    return fetchJson<Settings>('/settings');
  }, [fetchJson]);

  const updateSettings = useCallback(async (settings: Partial<{ apiKey: string; model: string; systemPrompt: string; maxTokens: number }>) => {
    return fetchJson<{ success: boolean }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }, [fetchJson]);

  const testApiKey = useCallback(async (apiKey: string, provider?: string) => {
    return fetchJson<{ success: boolean; model?: string; message?: string; error?: string }>('/test-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey, provider: provider || 'anthropic' }),
    });
  }, [fetchJson]);

  // Sessions
  const getSessions = useCallback(async () => {
    return fetchJson<Session[]>('/sessions');
  }, [fetchJson]);

  const createSession = useCallback(async (binding: Partial<Pick<Session, 'floydRunId' | 'floydSessionId' | 'floydProjectId'>> = {}) => {
    return fetchJson<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(binding),
    });
  }, [fetchJson]);

  const getSession = useCallback(async (id: string) => {
    return fetchJson<Session>(`/sessions/${id}`);
  }, [fetchJson]);

  const updateSession = useCallback(async (id: string, data: Partial<Session>) => {
    return fetchJson<Session>(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }, [fetchJson]);

  const deleteSession = useCallback(async (id: string) => {
    return fetchJson<{ success: boolean }>(`/sessions/${id}`, {
      method: 'DELETE',
    });
  }, [fetchJson]);

  // Chat (non-streaming)
  const sendMessage = useCallback(async (sessionId: string, message: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{ success: boolean; response: string; session: { id: string; title: string } }>('/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId, message }),
      });
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  // Chat (streaming with tool support)
  const sendMessageStream = useCallback(async (
    sessionId: string, 
    message: string,
    onText: (text: string) => void,
    onDone: (usage: any, sessionId: string, binding?: Pick<Session, 'floydRunId' | 'floydSessionId' | 'floydProjectId'>) => void,
    onError: (error: string) => void,
    onToolCall?: (tool: string, args: any, id: string) => void,
    onToolResult?: (tool: string, id: string, result: any, success: boolean) => void
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/core/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, enableTools: true }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      for await (const event of parseSse(response)) {
        const data = event.data;
        if (!data || typeof data !== 'object') continue;
        if (data.type === 'text') {
          onText(data.content);
        } else if (data.type === 'tool_call') {
          onToolCall?.(data.tool, data.args, data.id);
        } else if (data.type === 'tool_result') {
          onToolResult?.(data.tool, data.id, data.result, data.success);
        } else if (data.type === 'done') {
          onDone(data.usage, data.sessionId, {
            floydRunId: data.runId,
            floydSessionId: data.coreSessionId,
            floydProjectId: data.projectId,
          });
        } else if (data.type === 'error') {
          onError(data.error);
        }
      }
    } catch (err: any) {
      setError(err.message);
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get available tools
  const getTools = useCallback(async () => {
    return fetchJson<{ tools: any[] }>('/tools');
  }, [fetchJson]);

  // Execute tool directly
  const executeTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    return fetchJson<{ success: boolean; result?: any; error?: string }>('/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ name, args }),
    });
  }, [fetchJson]);

  const negotiateExperience = useCallback(() => fetchJson<Record<string, unknown>>('/core/experience/negotiate', {
    method: 'POST',
    body: '{}',
  }), [fetchJson]);

  const getExperience = useCallback((id = 'primary', signal?: AbortSignal) => fetchJson<ExperienceEnvelope>(`/core/experience/${encodeURIComponent(id)}`, { signal }), [fetchJson]);

  const updateExperience = useCallback((id: string, patch: Record<string, unknown>) => fetchJson<ExperienceEnvelope>(`/core/experience/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }), [fetchJson]);

  const getArtifact = useCallback(async (artifactId: string, signal?: AbortSignal): Promise<unknown> => {
    const response = await fetch(`${API_BASE}/core/artifacts/${encodeURIComponent(artifactId)}`, { signal });
    const payload = await responsePayload(response);
    if (!response.ok) throw new ApiError(response.status, payload);
    return payload;
  }, []);

  const answerQuestion = useCallback((sessionId: string, runId: string, requestId: string, answers: string[][], signal?: AbortSignal) => fetchJson<Record<string, unknown>>(`/core/sessions/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST', signal, body: JSON.stringify({ runId, requestId, answers }),
  }), [fetchJson]);

  const answerPermission = useCallback((sessionId: string, runId: string, requestId: string, reply: 'once' | 'always' | 'reject', signal?: AbortSignal) => fetchJson<Record<string, unknown>>(`/core/sessions/${encodeURIComponent(sessionId)}/permission`, {
    method: 'POST', signal, body: JSON.stringify({ runId, requestId, reply }),
  }), [fetchJson]);

  const watchExperience = useCallback(async (
    onEnvelope: (envelope: ExperienceEnvelope) => void | Promise<void>,
    signal: AbortSignal,
    lastEventId?: string,
  ) => {
    const response = await fetch(`${API_BASE}/core/experience/primary/stream`, {
      headers: lastEventId ? { 'Last-Event-ID': lastEventId } : {},
      signal,
    });
    for await (const event of parseSse(response)) {
      if (event.type === 'experience') await onEnvelope(event.data as ExperienceEnvelope);
    }
  }, []);

  const restoreTranscript = useCallback(async (sessionId: string, runId: string, signal?: AbortSignal): Promise<Message[]> => {
    const response = await fetch(`${API_BASE}/core/sessions/${encodeURIComponent(sessionId)}/attach?run_id=${encodeURIComponent(runId)}`, { signal });
    for await (const event of parseSse(response)) {
      if (event.type === 'transcript') return transcriptMessages(event.data?.messages);
    }
    return [];
  }, []);

  return {
    loading,
    error,
    checkHealth,
    getSettings,
    updateSettings,
    testApiKey,
    getSessions,
    createSession,
    getSession,
    updateSession,
    deleteSession,
    sendMessage,
    sendMessageStream,
    getTools,
    executeTool,
    negotiateExperience,
    getExperience,
    updateExperience,
    getArtifact,
    answerQuestion,
    answerPermission,
    watchExperience,
    restoreTranscript,
  };
}
