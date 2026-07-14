export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface Session {
  id: string;
  title: string;
  created: number;
  updated: number;
  messages: Message[];
  messageCount?: number;
  floydRunId?: string;
  floydSessionId?: string;
  floydProjectId?: string;
}

export interface ExperienceEnvelope {
  id: string;
  revision: number;
  active: { project_id: string | null; session_id: string | null; run_id: string | null };
  transcript_cursor: number;
  transcript_epoch: string | null;
  last_event_id: string | null;
  composer_draft: string;
  selected_view: string;
  selected_artifact_id: string | null;
  surfaces: Record<string, Record<string, unknown>>;
}

export interface Settings {
  model: string;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  systemPrompt?: string;
  maxTokens?: number;
}
