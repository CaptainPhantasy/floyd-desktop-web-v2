import { describe, expect, it, vi } from 'vitest';
import { publishCreatedRunContext } from './experience-publication';

describe('created run context publication', () => {
  it('publishes the run binding before returning and retries one revision conflict', async () => {
    const conflict = Object.assign(new Error('revision conflict'), { status: 409 });
    const client = {
      experience: vi.fn()
        .mockResolvedValueOnce({ revision: 4, surfaces: {} })
        .mockResolvedValueOnce({ revision: 5, surfaces: {} }),
      updateExperience: vi.fn()
        .mockRejectedValueOnce(conflict)
        .mockResolvedValueOnce({ revision: 6 }),
    };

    await publishCreatedRunContext(client, { projectId: 'p1', sessionId: 's1', runId: 'r1' });

    expect(client.updateExperience).toHaveBeenCalledTimes(2);
    expect(client.updateExperience.mock.calls[1]?.[1]).toMatchObject({
      expected_revision: 5,
      active: { project_id: 'p1', session_id: 's1', run_id: 'r1' },
      composer_draft: '',
    });
  });
});
