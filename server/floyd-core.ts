import * as fs from 'node:fs/promises';
import { FloydApiError, FloydClient } from '@floyd/sdk';

const DEFAULT_TOKEN_FILE = '/Volumes/Storage/FLOYD_RUNTIME/core/gateway.token';

export interface FloydCoreBridgeOptions {
  baseUrl?: string;
  token?: string;
  tokenFile?: string;
  projectId?: string;
  fetch?: typeof globalThis.fetch;
}

export class FloydCoreBridge {
  readonly client: FloydClient;
  readonly configuredProjectId?: string;

  constructor(options: FloydCoreBridgeOptions = {}) {
    const token = options.token ?? process.env.FLOYD_GATEWAY_TOKEN;
    const tokenFile = options.tokenFile ?? process.env.FLOYD_GATEWAY_TOKEN_FILE ?? DEFAULT_TOKEN_FILE;
    this.configuredProjectId = options.projectId ?? process.env.FLOYD_PROJECT_ID;
    this.client = new FloydClient({
      baseUrl: options.baseUrl ?? process.env.FLOYD_CORE_URL,
      token: token ?? (async () => (await fs.readFile(tokenFile, 'utf8')).trim()),
      fetch: options.fetch,
    });
  }

  async resolveProject(rootPath?: string, signal?: AbortSignal): Promise<string> {
    const state = await this.client.state(signal);
    if (this.configuredProjectId) {
      const configured = state.projects.find((project) => project.id === this.configuredProjectId);
      if (!configured) throw new Error(`FLOYD_PROJECT_ID does not exist in Floyd Core: ${this.configuredProjectId}`);
      return configured.id;
    }
    if (rootPath) {
      const exact = state.projects.find((project) => project.root_path === rootPath);
      if (exact) return exact.id;
    }
    if (state.projects.length === 1) return state.projects[0].id;
    throw new Error('Set FLOYD_PROJECT_ID or activate a Desktop project whose rootPath is registered in Floyd Core.');
  }
}

export { FloydApiError };
