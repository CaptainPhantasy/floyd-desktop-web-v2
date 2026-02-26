/**
 * Tests for ProcessManager
 *
 * These tests verify that the ProcessManager correctly passes environment
 * variables to spawned processes. This is critical for Floyd4 integration,
 * which requires ZAI_API_KEY to be set.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { ProcessManager } from './process-manager';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

describe('ProcessManager', () => {
  let processManager: ProcessManager;
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    processManager = new ProcessManager();
    mockSpawn = vi.mocked(spawn);

    // Create a mock child process
    const mockChildProcess = {
      pid: 12345,
      stdin: { write: vi.fn(), end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    } as unknown as ChildProcess;

    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startProcess', () => {
    it('should accept an env option in the options parameter', async () => {
      // This test verifies that startProcess accepts an env option
      // Currently this will FAIL because env is not in the interface

      const customEnv = {
        ZAI_API_KEY: 'test-api-key-12345',
        PATH: process.env.PATH,
      };

      // This should not throw - if it does, the interface doesn't support env
      const result = await processManager.startProcess({
        command: 'echo "test"',
        env: customEnv,
      });

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.pid).toBeDefined();
    });

    it('should pass custom env variables to the spawned process', async () => {
      // This test verifies that env is actually passed to spawn()
      // Currently this will FAIL because spawn() is called without env

      const customEnv = {
        ZAI_API_KEY: 'test-api-key-12345',
        FLOYD_GLM_MODEL: 'glm-5',
        PATH: process.env.PATH,
      };

      await processManager.startProcess({
        command: 'floyd4 --glm 5 -y',
        cwd: '/tmp',
        env: customEnv,
      });

      // Verify spawn was called with env option
      expect(mockSpawn).toHaveBeenCalled();

      const spawnCall = mockSpawn.mock.calls[0];
      const spawnOptions = spawnCall[2]; // Third argument is options

      // This assertion will FAIL because env is not currently passed
      expect(spawnOptions).toHaveProperty('env');
      expect(spawnOptions.env).toMatchObject({
        ZAI_API_KEY: 'test-api-key-12345',
        FLOYD_GLM_MODEL: 'glm-5',
      });
    });

    it('should inherit process.env when env option includes parent env', async () => {
      // Test that we can extend (not replace) the environment

      const customEnv = {
        ...process.env,  // Inherit all parent env
        ZAI_API_KEY: 'test-api-key-12345',
      };

      await processManager.startProcess({
        command: 'floyd4',
        env: customEnv,
      });

      const spawnCall = mockSpawn.mock.calls[0];
      const spawnOptions = spawnCall[2];

      expect(spawnOptions.env).toHaveProperty('PATH');
      expect(spawnOptions.env).toHaveProperty('ZAI_API_KEY');
    });
  });

  describe('Floyd4 integration scenario', () => {
    it('should allow spawning Floyd4 with API key in environment', async () => {
      // This is the actual use case we're fixing
      // Desktop Web needs to spawn Floyd4 with the ZAI_API_KEY set

      const floydEnv = {
        ...process.env,
        ZAI_API_KEY: '668b8e2f9b6b4bc79696ff8e814c8bd0.test',
        FLOYD_GLM_API_KEY: '1076d1f7ab854edb9702bb6687831492.test',
        FLOYD_GLM_MODEL: 'glm-5',
        FLOYD_GLM_ENDPOINT: 'https://api.z.ai/api/coding/paas/v4/chat/completions',
      };

      await processManager.startProcess({
        command: '/Users/douglastalley/.local/bin/floyd4 --glm 5 -y',
        cwd: '/Volumes/Storage/test-project',
        timeout: 0,
        env: floydEnv,
      });

      const spawnCall = mockSpawn.mock.calls[0];
      const spawnOptions = spawnCall[2];

      // All these assertions verify the fix works
      expect(spawnOptions.env.ZAI_API_KEY).toBe('668b8e2f9b6b4bc79696ff8e814c8bd0.test');
      expect(spawnOptions.env.FLOYD_GLM_MODEL).toBe('glm-5');
    });
  });
});
