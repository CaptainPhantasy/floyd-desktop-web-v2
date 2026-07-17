import { spawn } from 'node:child_process';
import net from 'node:net';

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const port = await freePort();
const mcpPort = await freePort();
const child = spawn(process.execPath, ['dist-server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    MCP_WS_PORT: String(mcpPort),
    GLM_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });

async function request(path, options) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

async function waitUntilReady() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}\n${output}`);
    try {
      const response = await request('/api/health');
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server did not become ready\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await waitUntilReady();
  const headers = { 'content-type': 'application/json' };

  let response = await request('/api/settings', {
    method: 'POST', headers, body: JSON.stringify({ provider: 'openai', model: 'gpt-4.1' }),
  });
  assert(response.status === 200, `OpenAI update failed: ${JSON.stringify(response)}`);
  response = await request('/api/settings');
  assert(response.body.provider === 'openai' && response.body.baseURL == null,
    `OpenAI inherited a stale endpoint: ${JSON.stringify(response.body)}`);

  response = await request('/api/settings', {
    method: 'POST', headers, body: JSON.stringify({ provider: 'glm', model: 'glm-5.1' }),
  });
  assert(response.status === 200, `GLM update failed: ${JSON.stringify(response)}`);
  response = await request('/api/settings');
  assert(response.body.baseURL === 'https://api.z.ai/api/paas/v4',
    `GLM endpoint mismatch: ${JSON.stringify(response.body)}`);

  response = await request('/api/settings', {
    method: 'POST', headers,
    body: JSON.stringify({ provider: 'anthropic-compatible', baseURL: 'https://gateway.example/v1/' }),
  });
  assert(response.status === 200, `compatible update failed: ${JSON.stringify(response)}`);
  response = await request('/api/settings');
  assert(response.body.baseURL === 'https://gateway.example/v1',
    `custom endpoint was not normalized: ${JSON.stringify(response.body)}`);

  response = await request('/api/settings', {
    method: 'POST', headers, body: JSON.stringify({ provider: 'invalid' }),
  });
  assert(response.status === 400 && response.body.error === 'Unsupported provider',
    `invalid provider was accepted: ${JSON.stringify(response)}`);

  console.log('provider routing smoke: PASS');
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }
}
