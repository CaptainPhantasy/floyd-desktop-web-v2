#!/usr/bin/env node
/**
 * Test script for Floyd CLI - single message mode
 */

import { EventEmitter } from 'events';

const DEFAULT_SERVER = 'http://localhost:3001';

class FloydClient extends EventEmitter {
  constructor(baseUrl = DEFAULT_SERVER) {
    super();
    this.baseUrl = baseUrl;
    this.sessionId = null;
  }

  async createSession() {
    const res = await fetch(`${this.baseUrl}/api/sessions`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create session');
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
    let imageData = null;

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
                imageData = data.data;
                process.stdout.write(`\n[Image received - ${data.format.toUpperCase()} - ${data.data.length} chars]\n`);
                break;
              case 'tool_result':
                if (data.result?.screenshot) {
                  process.stdout.write(`[Screenshot captured]\n`);
                }
                break;
              case 'done':
                process.stdout.write('\n[Done]\n');
                break;
              case 'error':
                process.stdout.write(`\n[Error: ${data.error}]\n`);
                break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    return { fullResponse, gotImage, imageData };
  }
}

// Test
async function test() {
  const client = new FloydClient();

  // Test 1: Simple message
  console.log('=== Test 1: Simple message ===');
  const result1 = await client.sendMessage('Say "hello" in 5 words or less');
  console.log('\nResponse:', result1.fullResponse);

  // Test 2: Screenshot
  console.log('\n=== Test 2: Screenshot ===');
  const result2 = await client.sendMessage('Take a screenshot of https://example.com');
  console.log('Got image:', result2.gotImage);
  if (result2.gotImage) {
    const fs = await import('fs');
    const path = `/tmp/floyd-test-screenshot-${Date.now()}.png`;
    fs.writeFileSync(path, Buffer.from(result2.imageData, 'base64'));
    console.log('Saved to:', path);
  }
}

test().catch(console.error);
