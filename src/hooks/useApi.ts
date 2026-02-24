/**
 * API hooks for Floyd Web
 */

import { useState, useCallback } from 'react';
import type { Session, Settings } from '@/types';

const API_BASE = '/api';

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
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }, []);

  // Health check
  const checkHealth = useCallback(async () => {
    return fetchJson<{ status: string; hasApiKey: boolean; model: string }>('/health');
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

  const createSession = useCallback(async () => {
    return fetchJson<Session>('/sessions', {
      method: 'POST',
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

  // ============================================
  // Floyd4 Chat - Full harness experience
  // ============================================

  // Get Floyd4 configuration
  const getFloydConfig = useCallback(async () => {
    const result = await fetchJson<{
      available: boolean;
      binaryPath: string;
      models: Array<{ id: string; name: string; flag: string }>;
      flags: Array<{ id: string; name: string; flag: string; description: string }>;
      defaultModel: string;
      defaultFlags: string[];
      promptLoaded: boolean;
      activeSession: { sessionId: string; pid: number; uptime: number } | null;
    }>('/chat/floyd/config');
    return result;
  }, [fetchJson]);

  // Start Floyd4 chat session
  const startFloydChat = useCallback(async (options: { model?: string; flags?: string[]; cwd?: string } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{ success: boolean; sessionId: string; pid: number; command: string }>('/chat/floyd/start', {
        method: 'POST',
        body: JSON.stringify(options),
      });
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  // Send message to Floyd4
  const sendFloydMessage = useCallback(async (message: string, options?: { model?: string; flags?: string[] }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{
        success: boolean;
        output: string;
        isRunning: boolean;
        exitCode: number | null;
        elapsed_ms: number;
      }>('/chat/floyd/message', {
        method: 'POST',
        body: JSON.stringify({ message, ...options }),
      });
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  // Get Floyd4 output
  const getFloydOutput = useCallback(async () => {
    const result = await fetchJson<{ output: string; isRunning: boolean; exitCode: number | null }>('/chat/floyd/output');
    return result;
  }, [fetchJson]);

  // Stop Floyd4 chat session
  const stopFloydChat = useCallback(async () => {
    const result = await fetchJson<{ success: boolean; message: string }>('/chat/floyd/session', {
      method: 'DELETE',
    });
    return result;
  }, [fetchJson]);

  // Floyd4 streaming message - polls for progressive output
  const sendFloydMessageStream = useCallback(async (
    message: string,
    options: {
      model?: string;
      flags?: string[];
      onThought?: (thought: string) => void;
      onText?: (text: string) => void;
      onDone?: (output: string) => void;
      onError?: (error: string) => void;
    } = {}
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      // Start the Floyd4 process
      const result = await fetchJson<{
        success: boolean;
        output: string;
        isRunning: boolean;
        exitCode: number | null;
        elapsed_ms: number;
        sessionId: string;
      }>('/chat/floyd/message', {
        method: 'POST',
        body: JSON.stringify({ 
          message, 
          model: options.model, 
          flags: options.flags 
        }),
      });
      
      // Process the output for thought/text sections
      const output = result.output || '';
      
      // Parse output for thought blocks (marked with 🧠 or [THINKING])
      const thoughtRegex = /🧠\s*\[THINKING\]([\s\S]*?)(?=🧠\s*\[|$)/gi;
      const thoughts: string[] = [];
      let thoughtMatch;
      
      // Extract thoughts
      while ((thoughtMatch = thoughtRegex.exec(output)) !== null) {
        thoughts.push(thoughtMatch[1].trim());
      }
      
      // If no thought markers, check for common thinking patterns
      if (thoughts.length === 0) {
        const lines = output.split('\n');
        let currentThought = '';
        let inThought = false;
        
        for (const line of lines) {
          if (line.includes('[THINKING]') || line.includes('Thinking...') || line.includes('🧠')) {
            inThought = true;
            currentThought += line + '\n';
          } else if (inThought && (line.startsWith('##') || line.startsWith('**') || line.trim() === '')) {
            if (currentThought.trim()) {
              thoughts.push(currentThought.trim());
            }
            currentThought = '';
            inThought = false;
          } else if (inThought) {
            currentThought += line + '\n';
          }
        }
        
        if (currentThought.trim()) {
          thoughts.push(currentThought.trim());
        }
      }
      
      // Emit thoughts
      for (const thought of thoughts) {
        options.onThought?.(thought);
      }
      
      // The main text is the output without the thought sections
      let mainText = output;
      for (const thought of thoughts) {
        mainText = mainText.replace(thought, '');
      }
      mainText = mainText.replace(thoughtRegex, '').trim();
      
      // Emit text
      if (mainText) {
        options.onText?.(mainText);
      }
      
      // Done
      options.onDone?.(output);
      
      return { output, sessionId: result.sessionId };
    } catch (err: any) {
      setError(err.message);
      options.onError?.(err.message);
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
    onDone: (usage: any, sessionId: string) => void,
    onError: (error: string) => void,
    onToolCall?: (tool: string, args: any, id: string) => void,
    onToolResult?: (tool: string, id: string, result: any, success: boolean) => void
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, enableTools: true }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text') {
                onText(data.content);
              } else if (data.type === 'tool_call') {
                onToolCall?.(data.tool, data.args, data.id);
              } else if (data.type === 'tool_result') {
                onToolResult?.(data.tool, data.id, data.result, data.success);
              } else if (data.type === 'done') {
                onDone(data.usage, data.sessionId);
              } else if (data.type === 'error') {
                onError(data.error);
              }
            } catch {
              // Ignore parse errors
            }
          }
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

  const uploadFiles = useCallback(async (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{
      success: boolean;
      files: Array<{
        id: string;
        name: string;
        size: number;
        type: 'image' | 'video' | 'document' | 'code' | 'data';
        mimeType: string;
        data: string;
      }>;
    }>;
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
    uploadFiles,
    // Floyd4 methods
    getFloydConfig,
    startFloydChat,
    sendFloydMessage,
    sendFloydMessageStream,
    getFloydOutput,
    stopFloydChat,
  };
}
