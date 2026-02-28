/**
 * API hooks for Floyd Web
 */

import { useState, useCallback } from 'react';
import type { Session, Settings, Message } from '@/types';

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

  const updateSettings = useCallback(async (settings: Partial<{ apiKey: string; model: string; systemPrompt: string; maxTokens: number; provider: string; temperature: number; baseURL: string }>) => {
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
  const sendFloydMessage = useCallback(async (sessionId: string, message: string, history?: Message[], options?: { model?: string; flags?: string[]; attachments?: any[] }) => {
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
        body: JSON.stringify({ sessionId, message, history, attachments: options?.attachments, ...options }),
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
    onToolResult?: (tool: string, id: string, result: any, success: boolean) => void,
    _onThinking?: (content: string) => void,
    attachments?: Array<{
      id: string;
      name: string;
      size: number;
      type: 'image' | 'video' | 'document' | 'code' | 'data';
      mimeType: string;
      data: string;
    }>
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, enableTools: true, attachments: attachments || [] }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';
        
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

  // GLM Vision diagnostic
  const getGLMDiagnostic = useCallback(async () => {
    return fetchJson<any>('/diagnostic/glm-vision');
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

  // ============================================
  // Multimedia Generation APIs (Phase 3)
  // ============================================

  // Get available voices for TTS
  const getVoices = useCallback(async () => {
    return fetchJson<{ voices: Array<{ id: string; name: string }> }>('/voices');
  }, [fetchJson]);

  // Generate image from prompt
  const generateImage = useCallback(async (prompt: string, options?: {
    quality?: 'standard' | 'hd';
    dimensions?: { width: number; height: number };
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{
        success: boolean;
        data?: string;
        metadata?: { model: string; format: string; generationTime: number };
        error?: string;
      }>('/generate/image', {
        method: 'POST',
        body: JSON.stringify({ prompt, options }),
      });
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  // Generate audio from text
  const generateAudio = useCallback(async (text: string, voiceId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{
        success: boolean;
        data?: string;
        metadata?: { model: string; format: string; generationTime: number };
        error?: string;
      }>('/generate/audio', {
        method: 'POST',
        body: JSON.stringify({ text, voiceId }),
      });
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  // Generate video (async - returns task ID)
  const generateVideo = useCallback(async (prompt: string, options?: {
    duration?: 5 | 10;
    fps?: 30 | 60;
    quality?: 'speed' | 'quality';
    imageUrl?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{
        success: boolean;
        taskId?: string;
        externalTaskId?: string;
        status?: string;
        message?: string;
        error?: string;
      }>('/generate/video', {
        method: 'POST',
        body: JSON.stringify({ prompt, options }),
      });
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  // Poll video generation status
  const getVideoStatus = useCallback(async (taskId: string) => {
    return fetchJson<{
      taskId: string;
      type: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      progress?: number;
      createdAt: number;
      updatedAt: number;
      completedAt?: number;
      result?: { data?: string; metadata?: Record<string, any> };
      error?: string;
    }>(`/generate/status/${taskId}`);
  }, [fetchJson]);

  // Get generation queue stats
  const getGenerationStats = useCallback(async () => {
    return fetchJson<{
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    }>('/generate/stats');
  }, [fetchJson]);

  // ============================================
  // Phase 5 Task 9: SSE Streaming for Media Generation
  // ============================================

  /**
   * Stream media generation progress via SSE
   * Returns media data when complete
   */
  const generateMediaStream = useCallback((
    message: string,
    callbacks: {
      onIntent?: (intent: string, confidence: number) => void;
      onProgress?: (stage: string, progress: number, message?: string) => void;
      onMedia?: (media: { type: 'image' | 'audio' | 'video'; data: string; mimeType: string; metadata?: any }) => void;
      onTaskCreated?: (taskId: string, pollUrl: string) => void;
      onClarification?: (message: string) => void;
      onError?: (error: string) => void;
      onDone?: () => void;
    }
  ) => {
    const controller = new AbortController();
    
    const startStream = async () => {
      try {
        const response = await fetch(`${API_BASE}/chat/generate/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          callbacks.onError?.(data.error || `HTTP ${response.status}`);
          return;
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          callbacks.onError?.('No response body');
          return;
        }
        
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'intent':
                    callbacks.onIntent?.(data.intent, data.confidence);
                    break;
                  case 'progress':
                    callbacks.onProgress?.(data.stage, data.progress, data.message);
                    break;
                  case 'complete':
                    if (data.media) {
                      callbacks.onMedia?.(data.media);
                    }
                    callbacks.onDone?.();
                    break;
                  case 'task-created':
                    callbacks.onTaskCreated?.(data.taskId, `/api/generate/stream/${data.taskId}`);
                    break;
                  case 'polling':
                    // Video generation - client should poll
                    callbacks.onProgress?.('processing', 30, data.message);
                    break;
                  case 'clarification':
                    callbacks.onClarification?.(data.message);
                    callbacks.onDone?.();
                    break;
                  case 'error':
                    callbacks.onError?.(data.error);
                    callbacks.onDone?.();
                    break;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          callbacks.onError?.(err.message);
        }
      }
    };
    
    startStream();
    
    // Return abort function
    return () => controller.abort();
  }, []);

  /**
   * Poll task progress via SSE
   * Returns task result when complete
   */
  const pollTaskProgress = useCallback((
    taskId: string,
    callbacks: {
      onProgress?: (status: string, progress: number) => void;
      onComplete?: (result: any) => void;
      onError?: (error: string) => void;
    }
  ) => {
    const controller = new AbortController();
    
    const startPoll = async () => {
      try {
        const response = await fetch(`${API_BASE}/generate/stream/${taskId}`, {
          signal: controller.signal,
        });
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          callbacks.onError?.(data.error || `HTTP ${response.status}`);
          return;
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          callbacks.onError?.('No response body');
          return;
        }
        
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'init':
                  case 'progress':
                    callbacks.onProgress?.(data.status, data.progress || 0);
                    break;
                  case 'complete':
                    callbacks.onComplete?.(data.result);
                    break;
                  case 'error':
                    callbacks.onError?.(data.error);
                    break;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          callbacks.onError?.(err.message);
        }
      }
    };
    
    startPoll();
    
    return () => controller.abort();
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
    getGLMDiagnostic,
    // Multimedia generation methods
    getVoices,
    generateImage,
    generateAudio,
    generateVideo,
    getVideoStatus,
    getGenerationStats,
    // Phase 5 Task 9: SSE streaming methods
    generateMediaStream,
    pollTaskProgress,
  };
}
