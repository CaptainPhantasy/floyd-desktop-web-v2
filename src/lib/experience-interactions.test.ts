import { describe, expect, it } from 'vitest';
import { modelRouteLabel, normalizePendingPermissions, normalizePendingQuestions, readableArtifact } from './experience-interactions';

describe('portable interaction normalization', () => {
  it('normalizes attributed Core question and permission snapshots', () => {
    expect(normalizePendingQuestions([{ run_id: 'r1', data: { id: 'q1', questions: [{ question: 'Choose', options: [{ label: 'A' }, { label: 'B' }] }] } }])).toEqual([
      { requestId: 'q1', prompts: [{ text: 'Choose', options: ['A', 'B'] }] },
    ]);
    expect(normalizePendingPermissions([{ data: { id: 'p1', permission: 'shell', patterns: ['npm test'] } }])).toEqual([
      { requestId: 'p1', title: 'shell', detail: 'npm test' },
    ]);
  });

  it('renders text artifacts directly and structured artifacts readably', () => {
    expect(readableArtifact('diff --git')).toBe('diff --git');
    expect(readableArtifact({ verdict: 'approve' })).toContain('"verdict": "approve"');
  });

  it('shows only public provider/model metadata with a Core fallback', () => {
    expect(modelRouteLabel({ provider: 'opencode-go', model: 'glm-5', credential_ref: 'secret-ref' })).toBe('opencode-go / glm-5');
    expect(modelRouteLabel({ credential_ref: 'must-not-render' })).toBe('Core default');
  });
});
