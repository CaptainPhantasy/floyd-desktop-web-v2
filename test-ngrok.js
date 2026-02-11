#!/usr/bin/env node
/**
 * Test script for Floyd CLI - ngrok tunnel test
 */

class FloydClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.sessionId = null;
  }

  async checkHealth() {
    const res = await fetch(`${this.baseUrl}/api/health`);
    return await res.json();
  }

  async createSession() {
    const res = await fetch(`${this.baseUrl}/api/sessions`, { method: 'POST' });
    const session = await res.json();
    this.sessionId = session.id;
    return session;
  }

  async sendMessage(message) {
    if (!this.sessionId) {
      await this.createSession();
    }

    const res = await fetch(`${this.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        message,
        enableTools: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Stream failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let gotImage = false;

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
              case 'text':
                process.stdout.write(data.content);
                fullResponse += data.content;
                break;
              case 'tool_call':
                process.stdout.write(`\n[Tool: ${data.tool}]\n`);
                break;
              case 'image':
                gotImage = true;
                process.stdout.write(`\n[Image - ${data.format.toUpperCase()} - ${data.data.length} chars]\n`);
                break;
              case 'done':
                process.stdout.write('\n[Done]\n');
                break;
              case 'error':
                process.stdout.write(`\n[Error: ${data.error}]\n`);
                break;
            }
          } catch (e) {}
        }
      }
    }

    return { fullResponse, gotImage };
  }
}

// Test with ngrok
async function test() {
  const NGROK_URL = 'https://crm-ai-pro-test.ngrok-free.app';
  const client = new FloydClient(NGROK_URL);

  console.log(`Testing ngrok tunnel: ${NGROK_URL}`);
  const health = await client.checkHealth();
  console.log('Health check:', health);

  console.log('\n=== Test: Screenshot via ngrok ===');
  const result = await client.sendMessage('Take a quick screenshot of https://httpbin.org/html');
  console.log('\nGot image:', result.gotImage);
  console.log('Response length:', result.fullResponse.length);
}

test().catch(console.error);
