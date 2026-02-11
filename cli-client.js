#!/usr/bin/env node
/**
 * Floyd CLI Client
 * Connect to Floyd Desktop Web V2 server from any terminal
 * Supports screenshot display via iTerm2 or imgcat
 */

import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Default server URL
const DEFAULT_SERVER = process.env.FLOYD_SERVER_URL || 'http://localhost:3001';

// ANSI escape codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

class FloydClient extends EventEmitter {
  constructor(baseUrl = DEFAULT_SERVER) {
    super();
    this.baseUrl = baseUrl;
    this.sessionId = null;
    this.connected = false;
  }

  async checkHealth() {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) throw new Error('Server not reachable');
    return await res.json();
  }

  async createSession() {
    const res = await fetch(`${this.baseUrl}/api/sessions`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create session');
    const session = await res.json();
    this.sessionId = session.id;
    return session;
  }

  async sendMessage(message, callbacks = {}) {
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
            await this.handleSSEEvent(data, callbacks);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }

  async handleSSEEvent(data, callbacks) {
    switch (data.type) {
      case 'text':
        if (callbacks.onText) await callbacks.onText(data.content);
        break;
      case 'tool_call':
        if (callbacks.onToolCall) await callbacks.onToolCall(data.tool, data.args);
        break;
      case 'tool_result':
        if (callbacks.onToolResult) await callbacks.onToolResult(data.tool, data.result, data.success);
        break;
      case 'image':
        if (callbacks.onImage) await callbacks.onImage(data);
        break;
      case 'done':
        if (callbacks.onDone) await callbacks.onDone(data);
        break;
      case 'error':
        if (callbacks.onError) await callbacks.onError(data.error);
        break;
    }
  }
}

// Image display functions
function displayImageIterm2(base64Data) {
  // iTerm2 inline image protocol
  const chars = `\x1b]1337;File=inline=1;width=80%%:${base64Data}\x1b\\`;
  return chars;
}

function displayImageKitty(base64Data) {
  // Kitty graphics protocol
  return `\x1b_Ga=T,f=100,t=f,d=${base64Data.length};${base64Data}\x1b\\`;
}

function saveTempImage(base64Data) {
  const path = `${homedir()}/.floyd-screenshot-${Date.now()}.png`;
  const buffer = Buffer.from(base64Data, 'base64');
  require('fs').writeFileSync(path, buffer);
  return path;
}

function detectTerminal() {
  const term = process.env.TERM_PROGRAM || '';
  const term2 = process.env.TERM || '';

  if (term === 'iTerm.app') return 'iterm';
  if (term2.includes('kitty')) return 'kitty';
  if (process.env.WAYLAND_DISPLAY || process.env.DISPLAY) return 'x11';
  return 'basic';
}

// REPL interface
async function repl(client) {
  const readline = (await import('readline')).createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const terminalType = detectTerminal();

  console.log(`${ANSI.bold}${ANSI.cyan}Floyd CLI Client${ANSI.reset}`);
  console.log(`${ANSI.dim}Connected to: ${client.baseUrl}${ANSI.reset}`);
  console.log(`${ANSI.dim}Terminal: ${terminalType}${ANSI.reset}`);
  console.log(`${ANSI.dim}Type 'help' for commands, Ctrl+D to exit${ANSI.reset}\n`);

  const ask = (prompt) => new Promise(resolve => readline.question(prompt, resolve));

  try {
    while (true) {
      const input = await ask(`${ANSI.green}>>>${ANSI.reset} `);

      if (!input) continue;
      if (input === 'exit' || input === 'quit') break;
      if (input === 'help') {
        console.log(`
${ANSI.bold}Commands:${ANSI.reset}
  help       - Show this help
  exit/quit  - Exit the client
  screenshot <url> - Take a screenshot of a URL
  clear      - Clear screen

${ANSI.bold}Examples:${ANSI.reset}
  Tell me about Pink Floyd
  Take a screenshot of https://example.com
  What's on https://github.com?
`);
        continue;
      }
      if (input === 'clear') {
        console.clear();
        continue;
      }

      // Special command for screenshot
      if (input.startsWith('screenshot ')) {
        const url = input.slice(12).trim();
        await client.sendMessage(`Use browser_screenshot to capture: ${url}`, {
          onText: (text) => process.stdout.write(text),
          onToolCall: (tool, args) => {
            process.stdout.write(`\n${ANSI.dim}[Using: ${tool}]${ANSI.reset}\n`);
          },
          onImage: (data) => {
            const { data: imgData, format } = data;
            console.log(`\n${ANSI.bold}[Screenshot received - ${format.toUpperCase()}]${ANSI.reset}\n`);

            if (terminalType === 'iterm') {
              process.stdout.write(displayImageIterm2(imgData));
            } else if (terminalType === 'kitty') {
              process.stdout.write(displayImageKitty(imgData));
            } else {
              // Save to temp file and show path
              const path = saveTempImage(imgData);
              console.log(`${ANSI.yellow}Image saved to:${ANSI.reset} ${path}`);
              if (terminalType === 'x11') {
                console.log(`${ANSI.dim}(Try: open ${path} on macOS or xdg-open ${path} on Linux)${ANSI.reset}`);
              }
            }
            console.log();
          },
          onDone: () => {
            console.log(`${ANSI.dim}\n[Done]${ANSI.reset}\n`);
          },
          onError: (err) => {
            console.error(`${ANSI.red}[Error]${ANSI.reset} ${err}`);
          },
        });
        continue;
      }

      // Normal message
      await client.sendMessage(input, {
        onText: (text) => process.stdout.write(text),
        onToolCall: (tool, args) => {
          process.stdout.write(`\n${ANSI.dim}[Using: ${tool}]${ANSI.reset}\n`);
        },
        onImage: (data) => {
          const { data: imgData, format } = data;
          console.log(`\n${ANSI.bold}[Screenshot - ${format.toUpperCase()}]${ANSI.reset}\n`);

          if (terminalType === 'iterm') {
            process.stdout.write(displayImageIterm2(imgData));
          } else if (terminalType === 'kitty') {
            process.stdout.write(displayImageKitty(imgData));
          } else {
            const path = saveTempImage(imgData);
            console.log(`${ANSI.yellow}Image saved to:${ANSI.reset} ${path}`);
          }
          console.log();
        },
        onToolResult: (tool, result, success) => {
          if (success && !result.screenshot) {
            console.log(`${ANSI.dim}[Done: ${tool}]${ANSI.reset}`);
          }
        },
        onDone: () => {
          console.log(`${ANSI.dim}\n[Done]${ANSI.reset}\n`);
        },
        onError: (err) => {
          console.error(`${ANSI.red}[Error]${ANSI.reset} ${err}`);
        },
      });
    }
  } finally {
    readline.close();
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const serverUrl = args[0] || DEFAULT_SERVER;

  const client = new FloydClient(serverUrl);

  try {
    await client.checkHealth();
    await repl(client);
  } catch (err) {
    console.error(`${ANSI.red}Error:${ANSI.reset}`, err.message);
    process.exit(1);
  }
}

main();
