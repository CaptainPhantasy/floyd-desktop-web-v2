/**
 * Phase 5 Task 10: E2E Integration Test
 * Tests the complete chat-to-generation flow
 * 
 * Run: node --experimental-vm-modules docs/exports/test-results/phase5-e2e-test.mjs
 * 
 * ALL GENERATED MEDIA IS SAVED to: docs/exports/generated/e2e-tests/
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = 'http://localhost:3001/api';
const OUTPUT_DIR = join(__dirname, '../generated/e2e-tests');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color, ...args) {
  console.log(colors[color], ...args, colors.reset);
}

let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
  try {
    await fn();
    log('green', `✓ ${name}`);
    testsPassed++;
  } catch (error) {
    log('red', `✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    testsFailed++;
  }
}

// HTTP helper
async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.data = data;
    throw error;
  }
  return data;
}

// ============================================
// Tests
// ============================================

async function testHealth() {
  await test('Health endpoint returns ok', async () => {
    const data = await fetchJson(`${API_BASE}/health`);
    if (data.status !== 'ok') throw new Error('Status not ok');
  });
}

async function testIntentParser() {
  // These tests make REAL API calls and SAVE outputs for verification
  // Generated files are saved to: docs/exports/generated/e2e-tests/

  await test('Intent parser recognizes image generation', async () => {
    const data = await fetchJson(`${API_BASE}/chat/generate`, {
      method: 'POST',
      body: JSON.stringify({ message: 'generate an image of a simple red circle on white background' }),
    });
    if (data.intent !== 'generate-image') throw new Error(`Wrong intent: ${data.intent}`);
    if (data.confidence < 0.9) throw new Error(`Low confidence: ${data.confidence}`);
    
    // SAVE the generated image for verification
    if (data.data && data.type === 'image') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}_test-red-circle.png`;
      const filepath = join(OUTPUT_DIR, filename);
      
      // Convert base64 to buffer and save
      const buffer = Buffer.from(data.data, 'base64');
      writeFileSync(filepath, buffer);
      
      console.log(`    📷 Image saved: ${filepath}`);
    }
  });

  await test('Intent parser recognizes audio intent', async () => {
    try {
      const data = await fetchJson(`${API_BASE}/chat/generate`, {
        method: 'POST',
        body: JSON.stringify({ message: 'say testing one two three' }),
      });
      if (data.intent === 'generate-audio') {
        // SAVE the generated audio for verification
        if (data.data && data.type === 'audio') {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${timestamp}_test-audio.mp3`;
          const filepath = join(OUTPUT_DIR, filename);
          
          const buffer = Buffer.from(data.data, 'base64');
          writeFileSync(filepath, buffer);
          
          console.log(`    🔊 Audio saved: ${filepath}`);
        }
        return;
      }
    } catch (error) {
      // Generation may fail without ElevenLabs API key - that's acceptable
      if (error.data?.intent === 'generate-audio') {
        console.log('    ⚠️  Audio generation skipped (no ElevenLabs API key)');
        return;
      }
    }
    throw new Error('Audio intent not recognized');
  });

  await test('Intent parser returns clarification for unknown', async () => {
    const data = await fetchJson(`${API_BASE}/chat/generate`, {
      method: 'POST',
      body: JSON.stringify({ message: 'hello there' }),
    });
    if (data.type !== 'clarification') throw new Error(`Wrong type: ${data.type}`);
  });
}

async function testSSEEndpoint() {
  await test('SSE stream endpoint exists', async () => {
    // Just check it doesn't 404 immediately (will timeout for non-existent task)
    const response = await fetch(`${API_BASE}/generate/stream/non-existent-task`);
    // Should return 404 for non-existent task
    if (response.status !== 404) {
      // Could also be SSE stream starting, which is fine
      if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    }
  });
}

async function testSessionManagement() {
  let sessionId;
  
  await test('Create session', async () => {
    const data = await fetchJson(`${API_BASE}/sessions`, { method: 'POST' });
    if (!data.id) throw new Error('No session ID');
    sessionId = data.id;
  });

  await test('Get session', async () => {
    const data = await fetchJson(`${API_BASE}/sessions/${sessionId}`);
    if (data.id !== sessionId) throw new Error('Session ID mismatch');
  });

  await test('Delete session', async () => {
    const data = await fetchJson(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
    if (!data.success) throw new Error('Delete failed');
  });
}

async function testGenerationStats() {
  await test('Generation stats endpoint', async () => {
    const data = await fetchJson(`${API_BASE}/generate/stats`);
    if (typeof data.total !== 'number') throw new Error('No total count');
  });
}

// ============================================
// Main
// ============================================

async function main() {
  log('blue', '\n=== Phase 5 E2E Integration Test ===\n');
  
  try {
    // Run all test suites
    await testHealth();
    await testIntentParser();
    await testSSEEndpoint();
    await testSessionManagement();
    await testGenerationStats();
    
    // Summary
    console.log('');
    log('blue', '=== Test Summary ===');
    log('green', `Passed: ${testsPassed}`);
    if (testsFailed > 0) {
      log('red', `Failed: ${testsFailed}`);
    }
    console.log('');
    
    if (testsFailed === 0) {
      log('green', '✓ All tests passed!');
      process.exit(0);
    } else {
      log('red', '✗ Some tests failed');
      process.exit(1);
    }
  } catch (error) {
    log('red', `Fatal error: ${error.message}`);
    log('yellow', '\nIs the server running? Start with: npm run dev');
    process.exit(1);
  }
}

main();
