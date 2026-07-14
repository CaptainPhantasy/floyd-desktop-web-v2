interface ExperienceClient {
  experience(id?: string, signal?: AbortSignal): Promise<{ revision: number; transcript_cursor?: number; transcript_epoch?: string | null; last_event_id?: string | null; surfaces?: Record<string, Record<string, unknown>> }>;
  updateExperience(id: string, patch: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
}

interface RunBinding {
  projectId: string;
  sessionId: string;
  runId: string;
}

/** Publish a just-created run before Desktop opens its token stream. */
export async function publishCreatedRunContext(client: ExperienceClient, binding: RunBinding, signal?: AbortSignal): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const envelope = await client.experience('primary', signal);
    try {
      await client.updateExperience('primary', {
        expected_revision: envelope.revision,
        active: {
          project_id: binding.projectId,
          session_id: binding.sessionId,
          run_id: binding.runId,
        },
        selected_view: 'desktop-chat',
        composer_draft: '',
        surface: {
          surface_id: 'desktop',
          sdk_version: '1.0.0',
          capabilities: ['artifacts', 'coding-runs', 'drafts', 'experience-stream', 'model-route-display', 'permissions', 'questions', 'selected-view', 'transcript-restore'],
          transcript_cursor: Number(envelope.surfaces?.desktop?.transcript_cursor ?? envelope.transcript_cursor ?? 0),
          transcript_epoch: envelope.transcript_epoch ?? null,
          last_event_id: envelope.last_event_id ?? null,
        },
      }, signal);
      return;
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : 0;
      if (status !== 409 || attempt === 1) throw error;
    }
  }
}
