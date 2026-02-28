/**
 * Floyd Web - Backend Server
 * 
 * Express server with Anthropic SDK integration.
 * Handles chat, streaming, sessions, and settings.
 */

import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import multer from 'multer';
import { ToolExecutor } from './tool-executor.js';
import { BUILTIN_TOOLS, MCPClient, MCPManager } from './mcp-client.js';
import { SkillsManager, Skill } from './skills-manager.js';
import { ProjectsManager, Project } from './projects-manager.js';
import { BroworkManager, AgentTask, Provider as BroworkProvider } from './browork-manager.js';
import { WebSocketMCPServer } from './ws-mcp-server.js';
import { ProcessManager } from './process-manager.js';
import { multimediaAPI } from './src/multimedia-api.js';
import { taskQueue } from './src/task-queue.js';
import { parseIntent } from './src/intent-parser.js';

// Load .env.local
config({ path: '.env.local' });

// Initialize WebSocket MCP server for Chrome extension
let wsMcpServer: WebSocketMCPServer | null = null;

// Initialize tool executor
const toolExecutor = new ToolExecutor([
  process.cwd(),
  process.env.HOME || '/',
  '/tmp',
]);

// Initialize process manager for CLI commands
const processManager = new ProcessManager();

// Initialize managers
let skillsManager: SkillsManager;
let projectsManager: ProjectsManager;
let broworkManager: BroworkManager;
let mcpManager: MCPManager;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
// Increase JSON body limit to 50MB to support large base64-encoded images
app.use(express.json({ limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|tiff|tif|pdf|doc|docx|txt|md|mp4|mov|webm|avi|js|ts|tsx|jsx|py|java|c|cpp|cs|go|rb|php|html|css|json|xml|yaml|yml|csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Serve static frontend files from dist/
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Data directory for sessions and settings
const DATA_DIR = path.join(__dirname, '../.floyd-data');

// Types
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface Session {
  id: string;
  title: string;
  created: number;
  updated: number;
  messages: Message[];
  customTitle?: string;  // Phase 1, Task 1.1
  messageCount?: number;
  pinned?: boolean;       // Phase 1, Task 1.4
  archived?: boolean;     // Phase 3, Task 3.3
  folder?: string;        // Phase 3, Task 3.2
}

type Provider = 'anthropic' | 'openai' | 'glm' | 'anthropic-compatible';

interface Settings {
  provider: Provider;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  maxTokens?: number;
  baseURL?: string; // For custom Anthropic-compatible endpoints
  temperature?: number; // Sampling temperature (0-1)
  promptStyle?: 'suggested' | 'floyd' | 'claude'; // PHASE 1 ITEM 3: Prompt style selector
  // P1-6: Multimedia API keys
  openaiApiKey?: string;     // For DALL-E image generation
  elevenLabsApiKey?: string; // For text-to-speech audio generation
  zaiApiKey?: string;        // For CogVideoX video generation
}

// Provider configurations
const PROVIDER_MODELS: Record<Provider, Array<{ id: string; name: string }>> = {
  anthropic: [
    { id: 'claude-sonnet-4-5-20250514', name: 'Claude 4.5 Sonnet (Recommended)' },
    { id: 'claude-opus-4-5-20250514', name: 'Claude 4.5 Opus (Most Capable)' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' },
  ],
  'anthropic-compatible': [
    { id: 'glm-4.7', name: 'GLM-4.7 (Standard, Complex Tasks)' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air (Lightweight, Faster)' },
    { id: 'glm-4-plus', name: 'GLM-4 Plus (Most Capable)' },
    { id: 'glm-4-0520', name: 'GLM-4-0520 (Recommended)' },
    { id: 'glm-4', name: 'GLM-4 (Standard)' },
    { id: 'glm-4-air', name: 'GLM-4 Air (Fast)' },
    { id: 'glm-4-airx', name: 'GLM-4 AirX (Faster)' },
    { id: 'glm-4-long', name: 'GLM-4 Long (128K Context)' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash (Cheapest)' },
    { id: 'claude-sonnet-4-5-20250514', name: 'Claude 4.5 Sonnet' },
    { id: 'claude-opus-4-5-20250514', name: 'Claude 4.5 Opus' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'custom-model', name: 'Custom Model (specify in settings)' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Recommended)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cheap)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Cheapest)' },
  ],
  glm: [
    { id: 'glm-4.6v', name: 'GLM-4.6v Vision (Native Vision Support)' },
    { id: 'glm-4-plus', name: 'GLM-4 Plus (Most Capable)' },
    { id: 'glm-4-0520', name: 'GLM-4-0520 (Recommended)' },
    { id: 'glm-4', name: 'GLM-4 (Standard)' },
    { id: 'glm-4-air', name: 'GLM-4 Air (Fast)' },
    { id: 'glm-4-airx', name: 'GLM-4 AirX (Faster)' },
    { id: 'glm-4-long', name: 'GLM-4 Long (128K Context)' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash (Cheapest)' },
  ],
};

// Default settings - use official BigModel endpoint for vision support
let settings: Settings = {
  provider: 'glm',
  apiKey: process.env.GLM_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
  model: 'glm-4.6v', // GLM-4.6v with native vision support
  maxTokens: 16384,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4', // Official endpoint for vision support
  temperature: 0.1,
  promptStyle: 'floyd',
};

// Floyd4 configuration
const FLOYD4_BINARY = '/Users/douglastalley/.local/bin/floyd4';
const FLOYD4_DEFAULT_MODEL = '46v';  // GLM 4.6 Vision
const FLOYD4_DEFAULT_FLAGS = ['yolo'];

// Load FLOYD.md as default system prompt
let FLOYD_PROMPT = '';
const FLOYD_MD_PATH = path.join(__dirname, 'prompts/floyd-vision-prompt.md');

async function loadFloydPrompt() {
  try {
    const content = await fs.readFile(FLOYD_MD_PATH, 'utf-8');
    FLOYD_PROMPT = content;
    console.log('[Server] Loaded FLOYD.md prompt (' + content.length + ' chars)');
  } catch (err) {
    console.log('[Server] Could not load FLOYD.md, using fallback prompt');
    FLOYD_PROMPT = 'You are FLOYD, a production engineer agent. Be precise, efficient, and focus on production-ready solutions.';
  }
}

// Check if Floyd4 is available
async function checkFloyd4Available(): Promise<boolean> {
  try {
    await fs.access(FLOYD4_BINARY);
    return true;
  } catch {
    return false;
  }
}

// Build environment variables for Floyd4 subprocess
// This is critical - Floyd4 needs these to authenticate with the API
function buildFloyd4Env(): NodeJS.ProcessEnv {
  return {
    ...process.env, // Inherit parent environment
    // ZAI API key (used by GLM models via ZAI endpoint)
    ZAI_API_KEY: settings.apiKey || '',
    // Floyd4-specific GLM configuration
    FLOYD_GLM_API_KEY: settings.apiKey || '',
    FLOYD_GLM_MODEL: settings.model || 'glm-5',
    FLOYD_GLM_ENDPOINT: settings.baseURL || 'https://api.z.ai/api/paas/v4',
    // Ensure Floyd4 knows we're in yolo mode
    FLOYD_MODE: 'yolo',
  };
}

// Active Floyd4 session for chat (single persistent session)
let activeFloyd4Session: {
  sessionId: string;
  pid: number;
  startedAt: number;
} | null = null;

// Sessions store
const sessions: Map<string, Session> = new Map();

// Initialize data directory
async function initDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Load FLOYD.md prompt
    await loadFloydPrompt();
    
    // Load settings if exists
    try {
      const settingsData = await fs.readFile(path.join(DATA_DIR, 'settings.json'), 'utf-8');
      const saved = JSON.parse(settingsData);
      settings = { ...settings, ...saved };
      console.log('[Server] Loaded settings from disk');
    } catch {
      console.log('[Server] No existing settings, using defaults');
    }
    
    // Load sessions if exists
    try {
      const sessionsDir = path.join(DATA_DIR, 'sessions');
      await fs.mkdir(sessionsDir, { recursive: true });
      const files = await fs.readdir(sessionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(sessionsDir, file), 'utf-8');
          const session = JSON.parse(data) as Session;
          sessions.set(session.id, session);
        }
      }
      console.log(`[Server] Loaded ${sessions.size} sessions from disk`);
    } catch {
      console.log('[Server] No existing sessions');
    }
    
    // Initialize skills manager
    skillsManager = new SkillsManager(DATA_DIR);
    await skillsManager.init();
    console.log(`[Server] Loaded ${skillsManager.getAll().length} skills`);
    
    // Initialize projects manager
    projectsManager = new ProjectsManager(DATA_DIR);
    await projectsManager.init();
    console.log(`[Server] Loaded ${projectsManager.getAll().length} projects`);
    
    // Initialize browork manager
    broworkManager = new BroworkManager(toolExecutor);
    if (settings.apiKey) {
      broworkManager.setApiKey(settings.apiKey);
    }
    broworkManager.setBaseURL(settings.baseURL);
    broworkManager.setModel(settings.model);
    broworkManager.setProvider(settings.provider);
    console.log('[Server] Browork manager initialized');

    // Initialize MCP manager
    mcpManager = new MCPManager();
    try {
      const mcpConfigPath = path.join(__dirname, '../MCP_SERVER_CONFIG.json');
      await mcpManager.loadConfig(mcpConfigPath);
      await mcpManager.startAll();
    } catch (error) {
      console.warn('[Server] Failed to initialize MCP manager:', error);
      console.log('[Server] Continuing without MCP servers');
    }
    
  } catch (error) {
    console.error('[Server] Failed to init data dir:', error);
  }
}

// Save settings to disk
async function saveSettings() {
  try {
    await fs.writeFile(
      path.join(DATA_DIR, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
  } catch (error) {
    console.error('[Server] Failed to save settings:', error);
  }
}

// Save session to disk
async function saveSession(session: Session) {
  try {
    const sessionsDir = path.join(DATA_DIR, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, `${session.id}.json`),
      JSON.stringify(session, null, 2)
    );
  } catch (error) {
    console.error('[Server] Failed to save session:', error);
  }
}

// Create API clients
function getAnthropicClient(): Anthropic | null {
  if (!settings.apiKey || (settings.provider !== 'anthropic' && settings.provider !== 'anthropic-compatible')) {
    return null;
  }
  return new Anthropic({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
  });
}

function getOpenAIClient(): OpenAI | null {
  if (!settings.apiKey || (settings.provider !== 'openai' && settings.provider !== 'glm')) {
    return null;
  }
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL, // Use the configured baseURL consistently
  });
}

// Unified client getter
function getClient(): Anthropic | OpenAI | null {
  if (settings.provider === 'openai' || settings.provider === 'glm') {
    return getOpenAIClient();
  } else if (settings.provider === 'anthropic' || settings.provider === 'anthropic-compatible') {
    return getAnthropicClient();
  }
  return null;
}

// ============ API Routes ============

// Health check (basic) - Now shows Floyd4 as default
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!settings.apiKey,
    provider: settings.provider,
    model: settings.model,
    mode: 'floyd4',
    flags: FLOYD4_DEFAULT_FLAGS,
    floydConfig: {
      binaryPath: FLOYD4_BINARY,
      defaultModel: FLOYD4_DEFAULT_MODEL,
      promptLoaded: FLOYD_PROMPT.length > 0,
    }
  });
});

// Enhanced health check for mobile/tunnel monitoring
app.get('/api/health/extended', async (req, res) => {
  const start = Date.now();
  
  // Check local server responsiveness
  let serverOk = true;
  try {
    // Simple check - if this endpoint runs, server is up
    serverOk = true;
  } catch {
    serverOk = false;
  }
  
  // Check MCP servers
  const mcpStatus = mcpManager ? await mcpManager.getStatus() : {};
  const mcpCount = Object.keys(mcpStatus).length;
  const mcpHealthy = Object.values(mcpStatus).every((s: any) => s.healthy);
  
  // Check Browork tasks
  const activeTasks = broworkManager ? broworkManager.getActiveCount() : 0;
  
  res.json({
    status: serverOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '4.0.0',
    services: {
      server: { status: 'ok', latencyMs: Date.now() - start },
      mcp: { status: mcpHealthy ? 'ok' : 'degraded', serverCount: mcpCount },
      browork: { status: 'ok', activeTasks },
    },
    config: {
      provider: settings.provider,
      model: settings.model,
      hasApiKey: !!settings.apiKey,
    }
  });
});

// Health check for tunnel monitoring (lightweight)
app.get('/api/health/ping', (req, res) => {
  res.json({ 
    pong: true, 
    timestamp: Date.now(),
    instance: 'floyd-desktop-v4'
  });
});

// GLM Vision diagnostic endpoint
app.get('/api/diagnostic/glm-vision', async (req, res) => {
  console.log('\n🔍 GLM Vision Diagnostic - Starting...');
  
  const diagnostic = {
    timestamp: new Date().toISOString(),
    settings: {
      provider: settings.provider,
      model: settings.model,
      baseURL: settings.baseURL,
      hasApiKey: !!settings.apiKey
    },
    tests: []
  };

  // Test 1: Basic connectivity
  try {
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL
    });
    
    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [{ role: 'user', content: 'Respond with "GLM connected"' }],
      max_tokens: 50
    });
    
    diagnostic.tests.push({
      name: 'Basic Connectivity',
      status: 'success',
      result: response.choices[0].message.content
    });
  } catch (error) {
    diagnostic.tests.push({
      name: 'Basic Connectivity', 
      status: 'failed',
      error: error.message
    });
  }

  // Test 2: Vision capability with tiny image
  try {
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL
    });
    
    // Create a tiny test image (1x1 red pixel)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';
    
    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe what you see in this image.' },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${testImageBase64}`
            }
          }
        ]
      }],
      max_tokens: 100
    });
    
    const visionResponse = response.choices[0].message.content;
    const canSeeImage = visionResponse && !visionResponse.includes('cannot') && !visionResponse.includes('unable');
    
    diagnostic.tests.push({
      name: 'Vision Capability',
      status: canSeeImage ? 'success' : 'partial',
      result: visionResponse,
      canSeeImage
    });
  } catch (error) {
    diagnostic.tests.push({
      name: 'Vision Capability',
      status: 'failed',
      error: error.message
    });
  }

  // Test 3: Model availability check
  try {
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL
    });
    
    // Try to get model info (if API supports it)
    diagnostic.tests.push({
      name: 'Model Available',
      status: 'info',
      result: `Model ${settings.model} is configured`
    });
  } catch (error) {
    diagnostic.tests.push({
      name: 'Model Available',
      status: 'warning',
      error: error.message
    });
  }

  console.log('🔍 GLM Vision Diagnostic - Results:', JSON.stringify(diagnostic, null, 2));
  res.json(diagnostic);
});

// OpenAI Image Generation diagnostic endpoint (P1-4)
app.get('/api/diagnostic/openai-image', async (req, res) => {
  console.log('🎨 OpenAI Image Diagnostic - Starting...');
  
  const diagnostic = {
    timestamp: new Date().toISOString(),
    configured: false,
    tests: [] as Array<{ name: string; status: string; result?: string; error?: string }>
  };

  // Check if OpenAI API key is configured
  const openaiApiKey = process.env.OPENAI_API_KEY || (settings as any).openaiApiKey;
  
  if (!openaiApiKey) {
    diagnostic.tests.push({
      name: 'Configuration Check',
      status: 'failed',
      error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable or openaiApiKey in settings.'
    });
    res.json(diagnostic);
    return;
  }

  diagnostic.configured = true;
  
  // Test 1: Configure multimediaAPI
  try {
    multimediaAPI.configure({ openaiApiKey });
    diagnostic.tests.push({
      name: 'MultimediaAPI Configuration',
      status: 'success',
      result: 'OpenAI client initialized'
    });
  } catch (error: any) {
    diagnostic.tests.push({
      name: 'MultimediaAPI Configuration',
      status: 'failed',
      error: error.message
    });
    res.json(diagnostic);
    return;
  }

  // Test 2: Image generation capability (minimal test)
  try {
    const result = await multimediaAPI.generateImage('A simple blue circle on white background', {
      quality: 'low',
      dimensions: { width: 1024, height: 1024 }
    });
    
    if (result.success && result.data) {
      diagnostic.tests.push({
        name: 'Image Generation',
        status: 'success',
        result: `Generated ${result.metadata?.format || 'image'} (${Math.round(result.data.length / 1024)}KB base64)`
      });
    } else {
      diagnostic.tests.push({
        name: 'Image Generation',
        status: 'failed',
        error: result.error || 'Unknown error'
      });
    }
  } catch (error: any) {
    diagnostic.tests.push({
      name: 'Image Generation',
      status: 'failed',
      error: error.message
    });
  }

  console.log('🎨 OpenAI Image Diagnostic - Results:', JSON.stringify(diagnostic, null, 2));
  res.json(diagnostic);
});

// ElevenLabs Audio Generation diagnostic endpoint (P1-5)
app.get('/api/diagnostic/elevenlabs', async (req, res) => {
  console.log('🔊 ElevenLabs Audio Diagnostic - Starting...');
  
  const diagnostic = {
    timestamp: new Date().toISOString(),
    configured: false,
    tests: [] as Array<{ name: string; status: string; result?: string; error?: string }>
  };

  // Check if ElevenLabs API key is configured
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || (settings as any).elevenLabsApiKey;
  
  if (!elevenLabsApiKey) {
    diagnostic.tests.push({
      name: 'Configuration Check',
      status: 'failed',
      error: 'ElevenLabs API key not configured. Set ELEVENLABS_API_KEY environment variable or elevenLabsApiKey in settings.'
    });
    res.json(diagnostic);
    return;
  }

  diagnostic.configured = true;
  
  // Test 1: Configure multimediaAPI
  try {
    multimediaAPI.configure({ elevenLabsApiKey });
    diagnostic.tests.push({
      name: 'MultimediaAPI Configuration',
      status: 'success',
      result: 'ElevenLabs client initialized'
    });
  } catch (error: any) {
    diagnostic.tests.push({
      name: 'MultimediaAPI Configuration',
      status: 'failed',
      error: error.message
    });
    res.json(diagnostic);
    return;
  }

  // Test 2: Get available voices
  try {
    const voices = await multimediaAPI.getVoices();
    
    if (voices && voices.length > 0) {
      diagnostic.tests.push({
        name: 'Voice List',
        status: 'success',
        result: `Found ${voices.length} voices: ${voices.slice(0, 3).map(v => v.name).join(', ')}${voices.length > 3 ? '...' : ''}`
      });
    } else {
      diagnostic.tests.push({
        name: 'Voice List',
        status: 'warning',
        result: 'No voices found or API returned empty list'
      });
    }
  } catch (error: any) {
    diagnostic.tests.push({
      name: 'Voice List',
      status: 'failed',
      error: error.message
    });
  }

  console.log('🔊 ElevenLabs Audio Diagnostic - Results:', JSON.stringify(diagnostic, null, 2));
  res.json(diagnostic);
});

// ============================================
// P2-1: Image Generation Endpoint
// ============================================
app.post('/api/generate/image', async (req, res) => {
  const { prompt, options } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Configure multimedia API with current settings
  const openaiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    return res.status(503).json({ 
      error: 'OpenAI API key not configured',
      hint: 'Add your OpenAI API key in Settings to enable image generation.',
      code: 'MISSING_API_KEY'
    });
  }
  
  multimediaAPI.configure({
    openaiApiKey: openaiKey,
    elevenLabsApiKey: settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY,
    zaiApiKey: settings.zaiApiKey || process.env.GLM_API_KEY,
  });

  try {
    const result = await multimediaAPI.generateImage(prompt, options);

    if (!result.success) {
      // Parse common error types for better user feedback
      let errorMessage = result.error || 'Image generation failed';
      let hint = '';
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        errorMessage = 'OpenAI rate limit exceeded';
        hint = 'Please wait a moment and try again. You may have made too many requests.';
      } else if (errorMessage.includes('content_policy') || errorMessage.includes('content policy')) {
        errorMessage = 'Content policy violation';
        hint = 'Your prompt may contain content that violates OpenAI\'s usage policy.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Image generation timed out';
        hint = 'The request took too long. Please try with a simpler prompt.';
      }
      
      return res.status(500).json({ 
        error: errorMessage, 
        hint,
        code: 'GENERATION_FAILED'
      });
    }

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error('[Image Gen] Error:', error.message);
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
});

// ============================================
// P2-4: Voices List Endpoint
// ============================================
app.get('/api/voices', async (req, res) => {
  // Configure multimedia API with current settings
  multimediaAPI.configure({
    elevenLabsApiKey: settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY,
  });

  try {
    const voices = await multimediaAPI.getVoices();
    res.json({ voices });
  } catch (error: any) {
    console.error('[Voices] Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch voices' });
  }
});

// ============================================
// P2-3: Audio Generation Endpoint
// ============================================
app.post('/api/generate/audio', async (req, res) => {
  const { text, voiceId, options } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (!voiceId) {
    return res.status(400).json({ 
      error: 'Voice ID is required',
      hint: 'Select a voice from the dropdown or fetch available voices from /api/voices',
      code: 'MISSING_VOICE_ID'
    });
  }

  // Configure multimedia API with current settings
  const elevenLabsKey = settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
  
  if (!elevenLabsKey) {
    return res.status(503).json({ 
      error: 'ElevenLabs API key not configured',
      hint: 'Add your ElevenLabs API key in Settings to enable audio generation.',
      code: 'MISSING_API_KEY'
    });
  }

  multimediaAPI.configure({
    elevenLabsApiKey: elevenLabsKey,
  });

  try {
    const result = await multimediaAPI.generateAudio(text, voiceId, options);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Audio generation failed' });
    }

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error('[Audio Gen] Error:', error.message);
    res.status(500).json({ error: error.message || 'Audio generation failed' });
  }
});

// ============================================
// P2-2: Video Generation Endpoint (Async)
// ============================================
app.post('/api/generate/video', async (req, res) => {
  const { prompt, options, imageUrl } = req.body;

  if (!prompt) {
    return res.status(400).json({ 
      error: 'Prompt is required',
      hint: 'Describe the video you want to generate.',
      code: 'MISSING_PROMPT'
    });
  }

  // Configure multimedia API with current settings
  const zaiKey = settings.zaiApiKey || process.env.GLM_API_KEY;
  
  if (!zaiKey) {
    return res.status(503).json({ 
      error: 'Zai/GLM API key not configured',
      hint: 'Add your GLM API key in Settings to enable video generation.',
      code: 'MISSING_API_KEY'
    });
  }

  multimediaAPI.configure({
    zaiApiKey: zaiKey,
  });

  // Create task in queue
  const task = taskQueue.createTask({
    type: 'video-generation',
    metadata: { prompt, model: 'cogvideox-3' },
  });

  // Update to processing
  taskQueue.updateStatus(task.id, 'processing');

  try {
    const result = await multimediaAPI.generateVideo(prompt, options, imageUrl);

    if (!result.success) {
      taskQueue.setError(task.id, result.error || 'Video generation failed');
      return res.status(500).json({ error: result.error, taskId: task.id });
    }

    // Store external task ID for polling
    taskQueue.updateMetadata(task.id, { externalTaskId: result.taskId });

    res.json({
      success: true,
      taskId: task.id,
      externalTaskId: result.taskId,
      status: 'processing',
      message: 'Video generation started. Poll /api/generate/status/:taskId for updates.',
    });
  } catch (error: any) {
    taskQueue.setError(task.id, error.message);
    console.error('[Video Gen] Error:', error.message);
    res.status(500).json({ error: error.message || 'Video generation failed', taskId: task.id });
  }
});

// ============================================
// P2-6: Task Status Polling Endpoint
// ============================================
app.get('/api/generate/status/:taskId', async (req, res) => {
  const { taskId } = req.params;

  const task = taskQueue.getTask(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // If task is processing and has external task ID, poll external API
  if (task.status === 'processing' && task.metadata?.externalTaskId) {
    multimediaAPI.configure({
      zaiApiKey: settings.zaiApiKey || process.env.GLM_API_KEY,
    });

    try {
      const result = await multimediaAPI.getVideoResult(task.metadata.externalTaskId);

      if (result.success && result.data) {
        // Video is ready
        taskQueue.setResult(task.id, {
          data: result.data,
          metadata: result.metadata,
        });
      } else if (result.success && result.taskId) {
        // Still processing - update progress if available
        taskQueue.updateStatus(task.id, 'processing');
      } else if (!result.success) {
        taskQueue.setError(task.id, result.error || 'Video generation failed');
      }
    } catch (error: any) {
      console.error('[Status Poll] Error:', error.message);
      // Don't fail the task on polling error, just log it
    }
  }

  // Get updated task
  const updatedTask = taskQueue.getTask(taskId);

  res.json({
    taskId: updatedTask!.id,
    type: updatedTask!.type,
    status: updatedTask!.status,
    progress: updatedTask!.progress,
    createdAt: updatedTask!.createdAt,
    updatedAt: updatedTask!.updatedAt,
    completedAt: updatedTask!.completedAt,
    result: updatedTask!.result,
    error: updatedTask!.error,
  });
});

// ============================================
// Task Queue Statistics Endpoint
// ============================================
app.get('/api/generate/stats', (req, res) => {
  res.json(taskQueue.getStats());
});

// ============================================
// Phase 5 Task 9: SSE Progress Events Endpoint
// Streams real-time progress for media generation tasks
// ============================================
app.get('/api/generate/stream/:taskId', async (req, res) => {
  const { taskId } = req.params;
  
  // Verify task exists
  const task = taskQueue.getTask(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial state
  res.write(`data: ${JSON.stringify({
    type: 'init',
    taskId: task.id,
    taskType: task.type,
    status: task.status,
    progress: task.progress || 0,
    timestamp: Date.now(),
  })}\n\n`);
  
  // Polling interval for task updates
  const pollInterval = setInterval(async () => {
    const currentTask = taskQueue.getTask(taskId);
    
    if (!currentTask) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Task disappeared',
        timestamp: Date.now(),
      })}\n\n`);
      clearInterval(pollInterval);
      res.end();
      return;
    }
    
    // For video tasks with external ID, poll the external API
    if (currentTask.status === 'processing' && currentTask.metadata?.externalTaskId) {
      multimediaAPI.configure({
        zaiApiKey: settings.zaiApiKey || process.env.GLM_API_KEY,
      });
      
      try {
        const result = await multimediaAPI.getVideoResult(currentTask.metadata.externalTaskId);
        
        if (result.success && result.data) {
          // Video is ready
          taskQueue.setResult(taskId, {
            data: result.data,
            metadata: result.metadata,
          });
        } else if (result.progress !== undefined) {
          // Update progress if available
          taskQueue.updateStatus(taskId, 'processing', result.progress);
        }
      } catch (error: any) {
        console.error('[SSE Poll] Error:', error.message);
      }
    }
    
    const updatedTask = taskQueue.getTask(taskId)!;
    
    // Send progress event
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      taskId: updatedTask.id,
      status: updatedTask.status,
      progress: updatedTask.progress || 0,
      timestamp: Date.now(),
    })}\n\n`);
    
    // Check if task is complete
    if (updatedTask.status === 'completed') {
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        taskId: updatedTask.id,
        result: updatedTask.result,
        timestamp: Date.now(),
      })}\n\n`);
      clearInterval(pollInterval);
      res.end();
    } else if (updatedTask.status === 'failed') {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        taskId: updatedTask.id,
        error: updatedTask.error,
        timestamp: Date.now(),
      })}\n\n`);
      clearInterval(pollInterval);
      res.end();
    }
  }, 1000); // Poll every second
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(pollInterval);
  });
});

// ============================================
// SSE for Chat-to-Generation with streaming
// Returns progress events and final media result
// ============================================
app.post('/api/chat/generate/stream', async (req, res) => {
  const { message } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ 
      error: 'Message is required',
      code: 'MISSING_MESSAGE'
    });
  }
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // Parse intent from the message
  const parsed = parseIntent(message);
  
  // Send intent parsed event
  res.write(`data: ${JSON.stringify({
    type: 'intent',
    intent: parsed.intent,
    confidence: parsed.confidence,
    timestamp: Date.now(),
  })}\n\n`);
  
  // If unknown intent, return clarifying question
  if (parsed.intent === 'unknown') {
    res.write(`data: ${JSON.stringify({
      type: 'clarification',
      message: parsed.clarifyingQuestion,
      timestamp: Date.now(),
    })}\n\n`);
    res.end();
    return;
  }
  
  // Configure multimedia API
  multimediaAPI.configure({
    openaiApiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY,
    elevenLabsApiKey: settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY,
    zaiApiKey: settings.zaiApiKey || process.env.GLM_API_KEY,
  });
  
  try {
    // Send progress: starting
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      stage: 'starting',
      message: 'Connecting to generation API...',
      progress: 10,
      timestamp: Date.now(),
    })}\n\n`);
    
    if (parsed.intent === 'generate-image') {
      const prompt = parsed.parameters.prompt;
      if (!prompt) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Could not extract prompt from message',
          timestamp: Date.now(),
        })}\n\n`);
        res.end();
        return;
      }
      
      // Send progress: generating
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        stage: 'generating',
        message: 'Generating image...',
        progress: 30,
        timestamp: Date.now(),
      })}\n\n`);
      
      const result = await multimediaAPI.generateImage(prompt);
      
      if (!result.success) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: result.error || 'Image generation failed',
          timestamp: Date.now(),
        })}\n\n`);
        res.end();
        return;
      }
      
      // Send progress: processing
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        stage: 'processing',
        message: 'Processing generated image...',
        progress: 80,
        timestamp: Date.now(),
      })}\n\n`);
      
      // Send complete event with media data
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        media: {
          type: 'image',
          data: result.data,
          mimeType: `image/${result.metadata?.format || 'png'}`,
          metadata: {
            prompt,
            width: result.metadata?.width,
            height: result.metadata?.height,
          },
        },
        timestamp: Date.now(),
      })}\n\n`);
      res.end();
      
    } else if (parsed.intent === 'generate-audio') {
      const text = parsed.parameters.text;
      const voiceId = parsed.parameters.voiceId || 'default';
      
      if (!text) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Could not extract text from message',
          timestamp: Date.now(),
        })}\n\n`);
        res.end();
        return;
      }
      
      // Send progress: generating
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        stage: 'generating',
        message: 'Synthesizing speech...',
        progress: 30,
        timestamp: Date.now(),
      })}\n\n`);
      
      const result = await multimediaAPI.generateAudio(text, voiceId);
      
      if (!result.success) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: result.error || 'Audio generation failed',
          timestamp: Date.now(),
        })}\n\n`);
        res.end();
        return;
      }
      
      // Send complete event with media data
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        media: {
          type: 'audio',
          data: result.data,
          mimeType: result.metadata?.mimeType || 'audio/mpeg',
          metadata: {
            text,
            duration: result.metadata?.duration,
          },
        },
        timestamp: Date.now(),
      })}\n\n`);
      res.end();
      
    } else if (parsed.intent === 'generate-video') {
      const prompt = parsed.parameters.prompt;
      
      if (!prompt) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Could not extract prompt from message',
          timestamp: Date.now(),
        })}\n\n`);
        res.end();
        return;
      }
      
      // Create task in queue
      const task = taskQueue.createTask({
        type: 'video-generation',
        metadata: { prompt },
      });
      
      // Send task created event
      res.write(`data: ${JSON.stringify({
        type: 'task-created',
        taskId: task.id,
        message: 'Video generation started...',
        progress: 10,
        timestamp: Date.now(),
      })}\n\n`);
      
      // Start video generation
      taskQueue.updateStatus(task.id, 'processing', 20);
      
      const result = await multimediaAPI.generateVideo(prompt);
      
      if (!result.success) {
        taskQueue.setError(task.id, result.error || 'Video generation failed');
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: result.error || 'Video generation failed',
          taskId: task.id,
          timestamp: Date.now(),
        })}\n\n`);
        res.end();
        return;
      }
      
      // Store external task ID for polling
      taskQueue.updateMetadata(task.id, { externalTaskId: result.taskId });
      
      // Send progress event with task ID for SSE polling
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        stage: 'processing',
        taskId: task.id,
        externalTaskId: result.taskId,
        message: 'Video is being generated. This may take a few minutes...',
        progress: 30,
        timestamp: Date.now(),
        pollUrl: `/api/generate/stream/${task.id}`,
      })}\n\n`);
      
      // For video, we don't keep the connection open indefinitely
      // Client should poll the SSE endpoint
      res.write(`data: ${JSON.stringify({
        type: 'polling',
        taskId: task.id,
        message: 'Use the pollUrl to receive progress updates',
        timestamp: Date.now(),
      })}\n\n`);
      res.end();
      
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: `Unknown intent: ${parsed.intent}`,
        timestamp: Date.now(),
      })}\n\n`);
      res.end();
    }
    
  } catch (error: any) {
    console.error('[SSE Generate] Error:', error.message);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message || 'Generation failed',
      timestamp: Date.now(),
    })}\n\n`);
    res.end();
  }
});

// Get available providers and models
app.get('/api/providers', (req, res) => {
  res.json({
    providers: [
      { id: 'anthropic', name: 'Anthropic' },
      { id: 'anthropic-compatible', name: 'Anthropic-Compatible (Custom Endpoint)' },
      { id: 'openai', name: 'OpenAI' },
      { id: 'glm', name: 'Zai GLM (Zhipu)' },
      // P1-7: Multimedia providers
      { id: 'openai-images', name: 'OpenAI Images (DALL-E)' },
      { id: 'elevenlabs', name: 'ElevenLabs (TTS)' },
      { id: 'zai-video', name: 'Zai Video (CogVideoX)' },
    ],
    models: PROVIDER_MODELS,
    // P1-7: Multimedia models registry
    multimediaModels: {
      'image-generation': [
        { id: 'dall-e-3', name: 'DALL-E 3 (Recommended)', provider: 'openai' },
        { id: 'dall-e-2', name: 'DALL-E 2 (Legacy)', provider: 'openai' },
      ],
      'video-generation': [
        { id: 'cogvideox-3', name: 'CogVideoX-3', provider: 'zai' },
      ],
      'audio-generation': [
        { id: 'eleven_turbo_v2', name: 'Eleven Turbo v2 (Fast)', provider: 'elevenlabs' },
        { id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2 (Recommended)', provider: 'elevenlabs' },
      ],
    },
  });
});

// Get settings
app.get('/api/settings', (req, res) => {
  res.json({
    provider: settings.provider,
    model: settings.model,
    hasApiKey: !!settings.apiKey,
    apiKeyPreview: settings.apiKey ? `${settings.apiKey.slice(0, 10)}...${settings.apiKey.slice(-4)}` : null,
    systemPrompt: settings.systemPrompt,
    maxTokens: settings.maxTokens,
    baseURL: settings.baseURL,
    temperature: settings.temperature,
    promptStyle: settings.promptStyle,
    // P1-6: Multimedia API keys
    hasOpenaiApiKey: !!settings.openaiApiKey,
    hasElevenLabsApiKey: !!settings.elevenLabsApiKey,
    hasZaiApiKey: !!settings.zaiApiKey,
  });
});

// Update settings
app.post('/api/settings', async (req, res) => {
  const { provider, apiKey, model, systemPrompt, maxTokens, baseURL, temperature, promptStyle, openaiApiKey, elevenLabsApiKey, zaiApiKey } = req.body;

  if (provider !== undefined) settings.provider = provider;
  if (apiKey !== undefined) settings.apiKey = apiKey;
  if (model !== undefined) settings.model = model;
  if (systemPrompt !== undefined) settings.systemPrompt = systemPrompt;
  if (maxTokens !== undefined) settings.maxTokens = maxTokens;
  if (baseURL !== undefined) settings.baseURL = baseURL;
  if (temperature !== undefined) settings.temperature = temperature;
  if (promptStyle !== undefined) settings.promptStyle = promptStyle;
  // P1-6: Multimedia API keys
  if (openaiApiKey !== undefined) settings.openaiApiKey = openaiApiKey;
  if (elevenLabsApiKey !== undefined) settings.elevenLabsApiKey = elevenLabsApiKey;
  if (zaiApiKey !== undefined) settings.zaiApiKey = zaiApiKey;

  // Update browork with new settings
  if (settings.apiKey) {
    broworkManager.setApiKey(settings.apiKey);
    broworkManager.setBaseURL(settings.baseURL);
    broworkManager.setModel(settings.model);
    broworkManager.setProvider(settings.provider);
  }

  // P1-6: Configure multimediaAPI with new keys
  multimediaAPI.configure({
    openaiApiKey: settings.openaiApiKey,
    elevenLabsApiKey: settings.elevenLabsApiKey,
    zaiApiKey: settings.zaiApiKey,
  });

  await saveSettings();

  res.json({ success: true });
});

// Test API key
app.post('/api/test-key', async (req, res) => {
  const { apiKey, provider } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'No API key provided' });
  }
  
  try {
    if (provider === 'openai') {
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });
      
      res.json({ 
        success: true, 
        model: response.model,
        message: 'OpenAI API key is valid'
      });
    } else if (provider === 'glm') {
      // GLM uses OpenAI-compatible API with official BigModel endpoint for vision
      const client = new OpenAI({ 
        apiKey,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4'
      });
      const response = await client.chat.completions.create({
        model: 'glm-4.6v', // Test with vision model
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });
      
      res.json({ 
        success: true, 
        model: response.model,
        message: 'GLM API key is valid'
      });
    } else if (provider === 'anthropic-compatible') {
      // Test with Z.ai endpoint using Anthropic SDK
      const client = new Anthropic({ 
        apiKey,
        baseURL: 'https://api.z.ai/api/anthropic'
      });
      const response = await client.messages.create({
        model: 'glm-4.7',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });
      
      res.json({ 
        success: true, 
        model: response.model,
        message: 'Z.ai API key is valid'
      });
    } else if (provider === 'openai-image') {
      // P1-8: Test OpenAI DALL-E image generation
      multimediaAPI.configure({ openaiApiKey: apiKey });
      const result = await multimediaAPI.generateImage('A red dot', {
        quality: 'low',
        dimensions: { width: 1024, height: 1024 }
      });
      
      if (result.success) {
        res.json({
          success: true,
          model: 'dall-e-3',
          message: 'OpenAI Image (DALL-E) API key is valid'
        });
      } else {
        throw new Error(result.error || 'Image generation failed');
      }
    } else if (provider === 'elevenlabs') {
      // P1-8: Test ElevenLabs TTS
      multimediaAPI.configure({ elevenLabsApiKey: apiKey });
      const voices = await multimediaAPI.getVoices();
      
      if (voices && voices.length > 0) {
        res.json({
          success: true,
          model: 'eleven_multilingual_v2',
          message: `ElevenLabs API key is valid (${voices.length} voices available)`
        });
      } else {
        throw new Error('No voices found - check API key');
      }
    } else if (provider === 'zai-video') {
      // P1-8: Test Zai Video API (just check configuration, actual test costs money)
      if (apiKey && apiKey.length > 10) {
        res.json({
          success: true,
          model: 'cogvideox-3',
          message: 'Zai Video API key format is valid'
        });
      } else {
        throw new Error('Invalid Zai Video API key format');
      }
    } else {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });
      
      res.json({ 
        success: true, 
        model: response.model,
        message: 'Anthropic API key is valid'
      });
    }
  } catch (error: any) {
    res.status(401).json({ 
      success: false, 
      error: error.message || 'Invalid API key' 
    });
  }
});

// File upload endpoint
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files as Express.Multer.File[];
    const uploadedFiles = files.map(file => {
      const fileType = file.mimetype.startsWith('image/') ? 'image' :
                       file.mimetype.startsWith('video/') ? 'video' :
                       file.mimetype.includes('pdf') || file.mimetype.includes('document') ? 'document' :
                       file.mimetype.includes('text') || file.mimetype.includes('markdown') ? 'code' :
                       'data';

      return {
        id: uuidv4(),
        name: file.originalname,
        size: file.size,
        type: fileType,
        mimeType: file.mimetype,
        data: file.buffer.toString('base64'),
      };
    });

    res.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error: any) {
    console.error('[Server] Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload files',
    });
  }
});

// === SKILLS API ===

// List all skills
app.get('/api/skills', (req, res) => {
  const skills = skillsManager.getAll().map(s => ({
    ...s,
    isActive: skillsManager.isActive(s.id),
  }));
  res.json({ skills });
});

// Get active skills
app.get('/api/skills/active', (req, res) => {
  res.json({ skills: skillsManager.getActiveSkills() });
});

// Create skill
app.post('/api/skills', async (req, res) => {
  const skill = await skillsManager.create(req.body);
  res.json(skill);
});

// Update skill
app.put('/api/skills/:id', async (req, res) => {
  const skill = await skillsManager.update(req.params.id, req.body);
  if (!skill) {
    return res.status(404).json({ error: 'Skill not found' });
  }
  res.json(skill);
});

// Delete skill
app.delete('/api/skills/:id', async (req, res) => {
  const deleted = await skillsManager.delete(req.params.id);
  res.json({ success: deleted });
});

// Activate/deactivate skill
app.post('/api/skills/:id/activate', async (req, res) => {
  await skillsManager.activate(req.params.id);
  res.json({ success: true });
});

app.post('/api/skills/:id/deactivate', async (req, res) => {
  await skillsManager.deactivate(req.params.id);
  res.json({ success: true });
});

// === PROJECTS API ===

// List all projects
app.get('/api/projects', (req, res) => {
  const projects = projectsManager.getAll();
  const active = projectsManager.getActive();
  res.json({ projects, activeId: active?.id || null });
});

// Get active project
app.get('/api/projects/active', (req, res) => {
  const project = projectsManager.getActive();
  res.json(project);
});

// Create project
app.post('/api/projects', async (req, res) => {
  const project = await projectsManager.create(req.body);
  res.json(project);
});

// Update project
app.put('/api/projects/:id', async (req, res) => {
  const project = await projectsManager.update(req.params.id, req.body);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  const deleted = await projectsManager.delete(req.params.id);
  res.json({ success: deleted });
});

// Set active project
app.post('/api/projects/:id/activate', async (req, res) => {
  await projectsManager.setActive(req.params.id);
  res.json({ success: true });
});

app.post('/api/projects/deactivate', async (req, res) => {
  await projectsManager.setActive(null);
  res.json({ success: true });
});

// Add file to project
app.post('/api/projects/:id/files', async (req, res) => {
  const { path: filePath, type, name, content } = req.body;
  
  let file;
  if (type === 'snippet') {
    file = await projectsManager.addSnippet(req.params.id, name, content);
  } else {
    file = await projectsManager.addFile(req.params.id, filePath);
  }
  
  if (!file) {
    return res.status(400).json({ error: 'Failed to add file' });
  }
  res.json(file);
});

// Remove file from project
app.delete('/api/projects/:id/files', async (req, res) => {
  const { path: filePath } = req.body;
  const removed = await projectsManager.removeFile(req.params.id, filePath);
  res.json({ success: removed });
});

// === BROWORK API (Sub-agent system) ===

// Get all agent tasks
app.get('/api/browork/tasks', (req, res) => {
  res.json({ tasks: broworkManager.getTasks() });
});

// Get single task
app.get('/api/browork/tasks/:id', (req, res) => {
  const task = broworkManager.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// Create new task
app.post('/api/browork/tasks', (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: 'Name and description required' });
  }
  
  // Make sure browork has current API key
  if (settings.apiKey) {
    broworkManager.setApiKey(settings.apiKey);
  }
  broworkManager.setModel(settings.model);
  
  const task = broworkManager.createTask(name, description);
  res.json(task);
});

// Start a task
app.post('/api/browork/tasks/:id/start', async (req, res) => {
  try {
    await broworkManager.startTask(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel a task
app.post('/api/browork/tasks/:id/cancel', (req, res) => {
  const cancelled = broworkManager.cancelTask(req.params.id);
  res.json({ success: cancelled });
});

// Delete a task
app.delete('/api/browork/tasks/:id', (req, res) => {
  const deleted = broworkManager.deleteTask(req.params.id);
  res.json({ success: deleted });
});

// Clear finished tasks
app.post('/api/browork/clear', (req, res) => {
  const cleared = broworkManager.clearFinished();
  res.json({ cleared });
});

// Archive/unarchive session (Phase 3, Task 3.3)
app.patch('/api/sessions/:id/archive', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const { archived } = req.body;
  
  // Toggle archived state
  session.archived = archived;
  session.updated = Date.now();
  
  await saveSession(session);
  
  res.json({ 
    success: true, 
    session: {
      id: session.id,
      archived: session.archived,
      updated: session.updated
    }
  });
});

// Assign session to folder (Phase 3, Task 3.2)
app.patch('/api/sessions/:id/folder', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const { folder } = req.body;
  
  // Assign folder (can be empty string to remove from folder)
  session.folder = folder || undefined;
  session.updated = Date.now();
  
  await saveSession(session);
  
  res.json({ 
    success: true, 
    session: {
      id: session.id,
      folder: session.folder,
      updated: session.updated
    }
  });
});

// Get all folders (Phase 3, Task 3.2)
app.get('/api/folders', (req, res) => {
  const folders = new Set<string>();
  
  sessions.forEach(session => {
    if (session.folder) {
      folders.add(session.folder);
    }
  });
  
  res.json({ 
    folders: Array.from(folders).sort()
  });
});

// List sessions (updated to filter by folder and archived status)
app.get('/api/sessions', (req, res) => {
  const { folder, archived } = req.query;
  
  let sessionList = Array.from(sessions.values());
  
  // Filter by folder if specified
  if (folder) {
    sessionList = sessionList.filter(s => s.folder === folder);
  }
  
  // Filter by archived status if specified
  if (archived === 'true') {
    sessionList = sessionList.filter(s => s.archived === true);
  } else if (archived === 'false') {
    sessionList = sessionList.filter(s => !s.archived);
  }
  
  const result = sessionList
    .map(s => ({
      id: s.id,
      title: s.title,
      created: s.created,
      updated: s.updated,
      messageCount: s.messages.length,
      customTitle: s.customTitle,
      pinned: s.pinned,
      archived: s.archived,
      folder: s.folder,
    }))
    .sort((a, b) => b.updated - a.updated);
  
  res.json(result);
});

// Create session
app.post('/api/sessions', async (req, res) => {
  const session: Session = {
    id: uuidv4(),
    title: 'New Chat',
    created: Date.now(),
    updated: Date.now(),
    messages: [],
  };
  
  sessions.set(session.id, session);
  await saveSession(session);
  
  res.json(session);
});

// Get session
app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// Update session
app.put('/api/sessions/:id', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const { title, messages } = req.body;
  if (title !== undefined) session.title = title;
  if (messages !== undefined) session.messages = messages;
  session.updated = Date.now();
  
  await saveSession(session);
  
  res.json(session);
});

// Rename session (Phase 1, Task 1.1)
app.patch('/api/sessions/:id/rename', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const { customTitle } = req.body;
  
  // Allow clearing custom title by setting to null or empty string
  if (customTitle === null || customTitle === '') {
    session.customTitle = undefined;
  } else if (typeof customTitle === 'string' && customTitle.trim().length > 0) {
    session.customTitle = customTitle.trim();
  } else {
    return res.status(400).json({ error: 'Invalid customTitle value' });
  }
  
  session.updated = Date.now();
  
  await saveSession(session);
  
  res.json({ 
    success: true, 
    session: {
      id: session.id,
      title: session.title,
      customTitle: session.customTitle,
      displayTitle: session.customTitle || session.title,
      updated: session.updated
    }
  });
});

// Regenerate last assistant response (Phase 1, Task 1.3)
app.post('/api/sessions/:id/regenerate', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Check if there's at least one assistant message to regenerate
  const lastAssistantIndex = [...session.messages].reverse().findIndex(m => m.role === 'assistant');
  if (lastAssistantIndex === -1) {
    return res.status(400).json({ error: 'No assistant message to regenerate' });
  }

  const actualIndex = session.messages.length - 1 - lastAssistantIndex;
  
  // Remove the last assistant message and any messages after it
  const messagesToKeep = session.messages.slice(0, actualIndex);
  const userMessages = messagesToKeep.filter(m => m.role === 'user');
  
  if (userMessages.length === 0) {
    return res.status(400).json({ error: 'No user message to respond to' });
  }

  // Set up SSE for streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';
  
  // Build system prompt
  let systemPrompt = settings.systemPrompt || `You are Floyd, an AI assistant.

## Multi-Instance Awareness
You are one instance in a Floyd mesh. There may be other Floyd instances (like CLI Floyd) that have different capabilities. When the user mentions "CLI Floyd" or asks to pass messages to other instances, acknowledge this and help facilitate communication.

## Your Role
- You are the Desktop/Web interface for Floyd
- You have access to browser automation, file operations, and command execution tools
- Other Floyd instances may have access to different tools (terminal, cache, etc.)
- Work collaboratively with other instances when asked

## Personality
Be direct, helpful, and technically competent. No excessive emoji or generic AI phrases. You're part of a unified AI system, not a standalone chatbot.`;
  
  // Add active skills
  const skillsContext = skillsManager.getSystemPromptAdditions();
  if (skillsContext) {
    systemPrompt += skillsContext;
  }
  
  // Add project context
  const projectContext = await projectsManager.getProjectContext();
  if (projectContext) {
    systemPrompt += projectContext;
  }

  try {
    // Build API messages (excluding tools for regeneration)
    const apiMessages = messagesToKeep
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role,
        content: m.content,
      }));

    if (settings.provider === 'openai' || settings.provider === 'glm') {
      // OpenAI/GLM flow
      const client = new OpenAI({ 
        apiKey: settings.apiKey,
        baseURL: settings.baseURL, // Use consistent endpoint
      });

      const response = await client.chat.completions.create({
        model: settings.model,
        max_tokens: settings.maxTokens || 16384,
        messages: [
          { role: 'system', content: systemPrompt },
          ...apiMessages,
        ],
        stream: true,
        temperature: settings.temperature || 0.1,
      });

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ type: 'text', content: delta })}\n\n`);
        }
      }
    } else {
      // Anthropic-compatible flow
      const client = new Anthropic({ 
        apiKey: settings.apiKey,
        baseURL: settings.baseURL,
      });

      const response = await client.messages.create({
        model: settings.model,
        max_tokens: settings.maxTokens || 16384,
        system: systemPrompt,
        messages: apiMessages,
        stream: true,
        temperature: settings.temperature || 0.1,
      });

      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
        }
      }
    }

    // Update session with regenerated response
    session.messages = messagesToKeep;
    session.messages.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
    });
    session.updated = Date.now();
    await saveSession(session);

    res.write(`data: ${JSON.stringify({ 
      type: 'done',
      content: fullResponse,
      sessionId: session.id
    })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('[Server] Regenerate error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Pin/unpin session (Phase 1, Task 1.4)
app.patch('/api/sessions/:id/pin', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const { pinned } = req.body;
  
  // Toggle pinned state
  session.pinned = pinned;
  session.updated = Date.now();
  
  await saveSession(session);
  
  res.json({ 
    success: true, 
    session: {
      id: session.id,
      pinned: session.pinned,
      updated: session.updated
    }
  });
});

// Continue response (Phase 2, Task 2.2)
app.post('/api/sessions/:id/continue', async (req, res) => {
  const { id } = req.params;
  
  const session = sessions.get(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (session.messages.length === 0) {
    return res.status(400).json({ error: 'No messages to continue from' });
  }
  
  const lastMessage = session.messages[session.messages.length - 1];
  if (lastMessage.role !== 'assistant') {
    return res.status(400).json({ error: 'Last message is not from assistant' });
  }
  
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  try {
    const client = getClient();
    if (!client) {
      return res.status(400).json({ error: 'API key not configured' });
    }
    
    // Build system prompt with context
    let systemPrompt = settings.systemPrompt || `You are Floyd, an AI assistant. You are one instance in a Floyd mesh - there may be other Floyd instances. Be direct and helpful.`;
    const skillsContext = skillsManager.getSystemPromptAdditions();
    if (skillsContext) {
      systemPrompt += skillsContext;
    }
    const projectContext = await projectsManager.getProjectContext();
    if (projectContext) {
      systemPrompt += projectContext;
    }
    
    // Build messages array, excluding the last incomplete assistant message
    const apiMessages = session.messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content,
    }));
    
    let continuedContent = lastMessage.content;
    
    // Stream the continuation
    if (settings.provider === 'openai' || settings.provider === 'glm') {
      const openaiClient = new OpenAI({ 
        apiKey: settings.apiKey,
        baseURL: settings.baseURL, // Use consistent endpoint
      });
      
      const response = await openaiClient.chat.completions.create({
        model: settings.model,
        max_tokens: settings.maxTokens || 8192,
        messages: [
          { role: 'system', content: systemPrompt },
          ...apiMessages,
          { role: 'assistant', content: continuedContent }, // Include partial response
        ],
        temperature: settings.temperature || 0.1,
      });
      
      const assistantMessage = response.choices[0].message;
      if (assistantMessage.content) {
        continuedContent += assistantMessage.content;
        res.write(`data: ${JSON.stringify({ type: 'text', content: assistantMessage.content })}\n\n`);
      }
      
      // Update session with continued message
      session.messages[session.messages.length - 1] = {
        role: 'assistant',
        content: continuedContent,
        timestamp: Date.now(),
      };
      session.updated = Date.now();
      await saveSession(session);
      
      res.write(`data: ${JSON.stringify({ type: 'done', content: continuedContent })}\n\n`);
      res.end();
      
    } else {
      // Anthropic-compatible flow
      const anthropicClient = new Anthropic({ 
        apiKey: settings.apiKey,
        baseURL: settings.baseURL,
      });
      
      const response = await anthropicClient.messages.create({
        model: settings.model,
        max_tokens: settings.maxTokens || 8192,
        system: systemPrompt,
        temperature: settings.temperature || 0.1,
        messages: [
          ...apiMessages,
          { role: 'assistant', content: continuedContent }, // Include partial response
        ],
      });
      
      for (const block of response.content) {
        if (block.type === 'text') {
          continuedContent += block.text;
          res.write(`data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`);
        }
      }
      
      // Update session with continued message
      session.messages[session.messages.length - 1] = {
        role: 'assistant',
        content: continuedContent,
        timestamp: Date.now(),
      };
      session.updated = Date.now();
      await saveSession(session);
      
      res.write(`data: ${JSON.stringify({ type: 'done', content: continuedContent })}\n\n`);
      res.end();
    }
    
  } catch (error: any) {
    console.error('[Server] Continue error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Edit user message (Phase 2, Task 2.1)
app.patch('/api/sessions/:id/messages/:messageIndex', async (req, res) => {
  const { id } = req.params;
  const messageIndex = parseInt(req.params.messageIndex);
  const { content } = req.body;
  
  const session = sessions.get(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (messageIndex < 0 || messageIndex >= session.messages.length) {
    return res.status(400).json({ error: 'Invalid message index' });
  }
  
  const message = session.messages[messageIndex];
  
  if (message.role !== 'user') {
    return res.status(400).json({ error: 'Can only edit user messages' });
  }
  
  // Update the message content
  message.content = content;
  session.updated = Date.now();
  
  // Remove all messages after the edited one (cascading delete)
  session.messages = session.messages.slice(0, messageIndex + 1);
  
  // Save the session
  await saveSession(session);
  
  res.json({ 
    success: true,
    messages: session.messages,
    session: {
      id: session.id,
      title: session.title,
      customTitle: session.customTitle,
      updated: session.updated,
      messageCount: session.messages.length
    }
  });
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  const id = req.params.id;
  sessions.delete(id);
  
  try {
    await fs.unlink(path.join(DATA_DIR, 'sessions', `${id}.json`));
  } catch {
    // Ignore if file doesn't exist
  }
  
  res.json({ success: true });
});

// ============================================
// Floyd4 Chat API - Full harness experience
// ============================================

// Get Floyd4 status and configuration
app.get('/api/chat/floyd/config', async (req, res) => {
  const isAvailable = await checkFloyd4Available();
  res.json({
    available: isAvailable,
    binaryPath: FLOYD4_BINARY,
    models: FLOYD_MODELS,
    flags: FLOYD_FLAGS,
    defaultModel: FLOYD4_DEFAULT_MODEL,
    defaultFlags: FLOYD4_DEFAULT_FLAGS,
    promptLoaded: FLOYD_PROMPT.length > 0,
    activeSession: activeFloyd4Session ? {
      sessionId: activeFloyd4Session.sessionId,
      pid: activeFloyd4Session.pid,
      uptime: Date.now() - activeFloyd4Session.startedAt,
    } : null,
  });
});

// Start a new Floyd4 chat session
app.post('/api/chat/floyd/start', async (req, res) => {
  const { model, flags, cwd } = req.body;
  
  const isAvailable = await checkFloyd4Available();
  if (!isAvailable) {
    return res.status(503).json({ error: 'Floyd4 not available at ' + FLOYD4_BINARY });
  }
  
  // Kill existing session if any
  if (activeFloyd4Session) {
    processManager.forceTerminate(activeFloyd4Session.sessionId);
    activeFloyd4Session = null;
  }
  
  // Build command with model and flags
  let command = FLOYD4_BINARY;
  
  // Add model flag
  const modelId = model || FLOYD4_DEFAULT_MODEL;
  const modelConfig = FLOYD_MODELS.find(m => m.id === modelId);
  if (modelConfig) {
    command += ` ${modelConfig.flag}`;
  }
  
  // Add flags
  const activeFlags = flags || FLOYD4_DEFAULT_FLAGS;
  for (const flagId of activeFlags) {
    const flagConfig = FLOYD_FLAGS.find(f => f.id === flagId);
    if (flagConfig) {
      command += ` ${flagConfig.flag}`;
    }
  }
  
  const sessionId = `floyd_chat_${Date.now()}`;

  try {
    const result = await processManager.startProcess({
      command,
      cwd: cwd || process.cwd(),
      timeout: 0, // No timeout for interactive session
      env: buildFloyd4Env(), // Pass API key and config to Floyd4
    });
    
    activeFloyd4Session = {
      sessionId,
      pid: result.pid,
      startedAt: Date.now(),
    };
    
    // Wait for Floyd4 to initialize and inject the FLOYD.md prompt
    setTimeout(async () => {
      if (FLOYD_PROMPT) {
        // Send FLOYD.md as initial context
        await processManager.interactWithProcess(sessionId, FLOYD_PROMPT);
      }
    }, 3000);
    
    res.json({
      success: true,
      sessionId,
      pid: result.pid,
      command,
      promptLoaded: FLOYD_PROMPT.length > 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start Floyd4' });
  }
});

// Send a message to the active Floyd4 session
app.post('/api/chat/floyd/message', async (req, res) => {
  const { message, sessionId, model, flags, silent, attachments } = req.body;
  
  if (!message && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Message or attachments are required' });
  }

  // Check if this is a vision model request with images
  const hasImages = attachments && attachments.some((att: any) => att.type === 'image');
  const modelId = model || FLOYD4_DEFAULT_MODEL;
  const isVisionModel = modelId.includes('v') || (modelId.includes('46') && hasImages);
  
  if (hasImages && isVisionModel) {
    return res.status(400).json({ 
      error: 'Vision models with images require streaming mode. Please use the streaming API endpoint instead.' 
    });
  }
  
  try {
    let actualSessionId: string;
    let finalMessage = message || '';

    // Handle attachments if any
    // For GLM vision models, we need to pass images directly to the model, not just file paths
    let imageAttachments: any[] = [];
    if (attachments && attachments.length > 0) {
      const tmpDir = path.join(process.cwd(), '.floyd-data', 'tmp', uuidv4());
      await fs.mkdir(tmpDir, { recursive: true });
      
      let attachmentContext = '\n\n[Attached Files]:\n';
      for (const att of attachments) {
        // Save file for potential tool usage
        const fileBuffer = Buffer.from(att.data, 'base64');
        const filePath = path.join(tmpDir, att.name);
        await fs.writeFile(filePath, fileBuffer);
        attachmentContext += `- ${filePath}\n`;
        
        // Collect image data for direct model input
        if (att.type === 'image') {
          imageAttachments.push({
            type: 'image_url',
            image_url: {
              url: `data:${att.mimeType || 'image/jpeg'};base64,${att.data}`
            }
          });
        }
      }
      
      // For vision models, include both file paths (for tools) and direct image reference
      if (imageAttachments.length > 0 && (model || FLOYD4_DEFAULT_MODEL).includes('v')) {
        finalMessage += attachmentContext + '\n\n[Images provided for vision analysis]';
      } else {
        finalMessage += attachmentContext;
      }
    }
    
    // 1. Ensure we have an active interactive session
    if (!activeFloyd4Session) {
      let command = FLOYD4_BINARY;
      const modelId = model || FLOYD4_DEFAULT_MODEL;
      const modelConfig = FLOYD_MODELS.find(m => m.id === modelId);
      if (modelConfig) command += ` ${modelConfig.flag}`;
      
      const activeFlags = flags || FLOYD4_DEFAULT_FLAGS;
      for (const flagId of activeFlags) {
        const flagConfig = FLOYD_FLAGS.find(f => f.id === flagId);
        if (flagConfig) command += ` ${flagConfig.flag}`;
      }
      
      const result = await processManager.startProcess({
        command,
        cwd: process.cwd(),
        timeout: 0, // Persistent session
        env: buildFloyd4Env(), // Pass API key and config to Floyd4
      });
      
      actualSessionId = result.sessionId;
      activeFloyd4Session = {
        sessionId: actualSessionId,
        pid: result.pid,
        startedAt: Date.now(),
      };
      
      // Wait for it to boot up and optionally inject the initial prompt
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (FLOYD_PROMPT) {
        await processManager.interactWithProcess(actualSessionId, FLOYD_PROMPT);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      actualSessionId = activeFloyd4Session.sessionId;
    }
    
    const startTime = Date.now();
    
    // Get current output length so we only return new output
    const initialOutput = processManager.readProcessOutput(actualSessionId, 2000).output;
    const initialLength = initialOutput.length;
    
    // Send input to the running interactive process
    await processManager.interactWithProcess(actualSessionId, finalMessage);
    
    // Wait for the response to complete
    let output = '';
    let lastOutput = '';
    let unchangedCount = 0;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max wait
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const status = processManager.getSessionStatus(actualSessionId);
      
      if (!status || !status.isRunning) {
        // Process died
        break;
      }
      
      const currentFullOutput = processManager.readProcessOutput(actualSessionId, 2000).output;
      output = currentFullOutput.substring(initialLength).trim();
      
      // Common interactive prompt markers
      if (output.endsWith('> ') || output.endsWith('$ ') || output.includes('floyd>')) {
        break;
      }
      
      if (output === lastOutput && output.length > 0) {
        unchangedCount++;
        if (unchangedCount >= 3) {
          // Output hasn't changed for 3 seconds, assume done
          break;
        }
      } else {
        unchangedCount = 0;
      }
      
      lastOutput = output;
      attempts++;
    }
    
    // Clean up trailing prompts
    output = output.replace(/floyd>\s*$/, '').trim();
    
    // Save to active session if provided
    if (sessionId) {
      let session = sessions.get(sessionId);
      if (session) {
        // If message wasn't already added (we don't get 'history' here directly synced, so we append the new pair)
        session.messages.push({
          role: 'user',
          content: message || '[Image Attached]',
          timestamp: startTime,
          attachments: attachments
        });
        
        // Save immediately after user message for real-time sync
        session.updated = Date.now();
        await saveSession(session);
        
        if (output) {
          session.messages.push({
            role: 'assistant',
            content: output,
            timestamp: Date.now(),
          });
          
          // Save again after assistant response
          session.updated = Date.now();
          await saveSession(session);
        }
      }
    }
    
    const elapsed = Date.now() - startTime;
    
    res.json({
      success: true,
      output,
      isRunning: true,
      exitCode: null,
      elapsed_ms: elapsed,
      sessionId: actualSessionId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send message to Floyd4' });
  }
});

// Get Floyd4 chat output
app.get('/api/chat/floyd/output', (req, res) => {
  if (!activeFloyd4Session) {
    return res.json({ output: '', isRunning: false, exitCode: null });
  }
  
  const output = processManager.readProcessOutput(activeFloyd4Session.sessionId, 1000);
  res.json({
    output: output.output,
    isRunning: output.isRunning,
    exitCode: output.exitCode,
  });
});

// Stop Floyd4 chat session
app.delete('/api/chat/floyd/session', (req, res) => {
  if (!activeFloyd4Session) {
    return res.json({ success: true, message: 'No active session' });
  }
  
  const result = processManager.forceTerminate(activeFloyd4Session.sessionId);
  activeFloyd4Session = null;
  
  res.json(result);
});

// ============================================
// Phase 5: Chat-to-Generation Router
// Parses natural language and routes to multimedia generation
// ============================================
app.post('/api/chat/generate', async (req, res) => {
  const { message } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ 
      error: 'Message is required',
      code: 'MISSING_MESSAGE'
    });
  }
  
  // Parse intent from the message
  const parsed = parseIntent(message);
  
  // If unknown intent, return clarifying question
  if (parsed.intent === 'unknown') {
    return res.json({
      type: 'clarification',
      intent: 'unknown',
      confidence: parsed.confidence,
      message: parsed.clarifyingQuestion,
    });
  }
  
  // Configure multimedia API with current settings
  multimediaAPI.configure({
    openaiApiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY,
    elevenLabsApiKey: settings.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY,
    zaiApiKey: settings.zaiApiKey || process.env.GLM_API_KEY,
  });
  
  try {
    let result: any;
    let responseType: string;
    
    switch (parsed.intent) {
      case 'generate-image': {
        const prompt = parsed.parameters.prompt;
        if (!prompt) {
          return res.status(400).json({
            error: 'Could not extract prompt from message',
            hint: 'Try "generate an image of [description]"',
            code: 'MISSING_PROMPT'
          });
        }
        
        result = await multimediaAPI.generateImage(prompt);
        responseType = 'image';
        
        if (!result.success) {
          return res.status(500).json({
            error: result.error || 'Image generation failed',
            intent: parsed.intent,
            code: 'GENERATION_FAILED'
          });
        }
        
        return res.json({
          type: responseType,
          intent: parsed.intent,
          confidence: parsed.confidence,
          data: result.data,
          metadata: result.metadata,
          prompt,
        });
      }
      
      case 'generate-audio': {
        const text = parsed.parameters.text;
        const voiceId = parsed.parameters.voiceId || 'default';
        
        if (!text) {
          return res.status(400).json({
            error: 'Could not extract text from message',
            hint: 'Try "say [text to speak]"',
            code: 'MISSING_TEXT'
          });
        }
        
        result = await multimediaAPI.generateAudio(text, voiceId);
        responseType = 'audio';
        
        if (!result.success) {
          return res.status(500).json({
            error: result.error || 'Audio generation failed',
            intent: parsed.intent,
            code: 'GENERATION_FAILED'
          });
        }
        
        return res.json({
          type: responseType,
          intent: parsed.intent,
          confidence: parsed.confidence,
          data: result.data,
          metadata: result.metadata,
          text,
          voiceId,
        });
      }
      
      case 'generate-video': {
        const prompt = parsed.parameters.prompt;
        
        if (!prompt) {
          return res.status(400).json({
            error: 'Could not extract prompt from message',
            hint: 'Try "create a video of [description]"',
            code: 'MISSING_PROMPT'
          });
        }
        
        result = await multimediaAPI.generateVideo(prompt, {
          duration: parsed.parameters.duration,
        });
        responseType = 'video';
        
        if (!result.success) {
          return res.status(500).json({
            error: result.error || 'Video generation failed',
            intent: parsed.intent,
            code: 'GENERATION_FAILED'
          });
        }
        
        // Video is async, return task info for polling
        return res.json({
          type: responseType,
          intent: parsed.intent,
          confidence: parsed.confidence,
          taskId: result.taskId,
          status: 'processing',
          prompt,
          message: 'Video generation started. Poll /api/generate/status/:taskId for progress.',
        });
      }
      
      default:
        return res.status(500).json({
          error: 'Unhandled intent type',
          intent: parsed.intent,
          code: 'UNHANDLED_INTENT'
        });
    }
  } catch (error: any) {
    console.error('[Chat Generate] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Generation failed',
      intent: parsed.intent,
      code: 'INTERNAL_ERROR'
    });
  }
});

// Send message (non-streaming)
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  
  const client = getClient();
  if (!client) {
    return res.status(400).json({ error: 'API key not configured' });
  }
  
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId || uuidv4(),
      title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
      created: Date.now(),
      updated: Date.now(),
      messages: [],
    };
    sessions.set(session.id, session);
  }
  
  // Add user message
  session.messages.push({
    role: 'user',
    content: message,
    timestamp: Date.now(),
  });
  
  try {
    const response = await (client as Anthropic).messages.create({
      model: settings.model,
      max_tokens: settings.maxTokens || 8192,
      system: settings.systemPrompt,
      temperature: settings.temperature || 0.1,
      messages: session.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });
    
    const assistantContent = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');
    
    // Add assistant message
    session.messages.push({
      role: 'assistant',
      content: assistantContent,
      timestamp: Date.now(),
    });
    
    session.updated = Date.now();
    await saveSession(session);
    
    res.json({
      success: true,
      response: assistantContent,
      usage: response.usage,
      session: {
        id: session.id,
        title: session.title,
      },
    });
  } catch (error: any) {
    console.error('[Server] Chat error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get response' 
    });
  }
});

// Get available tools
app.get('/api/tools', (req, res) => {
  res.json({ tools: BUILTIN_TOOLS });
});

// Execute a tool directly
app.post('/api/tools/execute', async (req, res) => {
  const { name, args } = req.body;
  let result;
  if (mcpManager && name.includes(':')) {
    // This is an MCP tool
    try {
      result = await mcpManager.callTool(name, args);
      res.json({ success: true, result });
    } catch (error: any) {
      res.json({ success: false, error: error.message });
    }
  } else {
    // Built-in tool
    result = await toolExecutor.execute(name, args);
    res.json(result);
  }
});

// CLI execute endpoint - for mobile PWA to run CLI commands
app.post('/api/cli/execute', async (req, res) => {
  const { command, cwd, timeout = 60000 } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Command is required' });
  }

  // Security: Only allow safe commands (alphanumeric, spaces, and common shell chars)
  const safeCommandPattern = /^[\w\s\-\.\/\$\{\}\(\)\[\]\:\=\+\'\"\`\<\>\|\&\;\~]+$/;
  if (!safeCommandPattern.test(command)) {
    return res.status(400).json({ error: 'Command contains invalid characters' });
  }

  const sessionId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    // Execute via processManager
    const result = await processManager.startProcess({
      command,
      cwd: cwd || process.cwd(),
      timeout,
    });

    res.json({
      sessionId,
      pid: result.pid,
      status: 'started',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start process' });
  }
});

// Floyd4 configuration options
const FLOYD_MODELS = [
  { id: '5', name: 'GLM 5 (Latest)', flag: '--glm 5' },
  { id: '47', name: 'GLM 4.7', flag: '--glm 47' },
  { id: '47f', name: 'GLM 4.7 Flash', flag: '--glm 47f' },
  { id: '47x', name: 'GLM 4.7X', flag: '--glm 47x' },
  { id: '46', name: 'GLM 4.6', flag: '--glm 46' },
  { id: '46v', name: 'GLM 4.6 Vision', flag: '--glm 46v' },
  { id: '45', name: 'GLM 4.5', flag: '--glm 45' },
  { id: '45v', name: 'GLM 4.5 Vision', flag: '--glm 45v' },
  { id: '45a', name: 'GLM 4.5 Advanced', flag: '--glm 45a' },
  { id: '4p', name: 'GLM 4 Plus', flag: '--glm 4p' },
  { id: '432', name: 'GLM 4 32K', flag: '--glm 432' },
];

const FLOYD_FLAGS = [
  { id: 'yolo', name: 'Yolo Mode', flag: '-y', description: 'Auto-accept all permissions' },
  { id: 'debug', name: 'Debug Mode', flag: '-d', description: 'Enable debug logging' },
];

// Get Floyd4 configuration options
app.get('/api/floyd/config', (req, res) => {
  res.json({
    binaryPath: '/Users/douglastalley/.local/bin/floyd4',
    models: FLOYD_MODELS,
    flags: FLOYD_FLAGS,
    defaultCwd: process.cwd(),
  });
});

// Start Floyd4 with configuration
app.post('/api/floyd/start', async (req, res) => {
  const { model, flags = [], cwd, prompt } = req.body;

  // Build the command
  let command = '/Users/douglastalley/.local/bin/floyd4';
  
  // Add model flag
  if (model) {
    const modelConfig = FLOYD_MODELS.find(m => m.id === model);
    if (modelConfig) {
      command += ` ${modelConfig.flag}`;
    }
  }
  
  // Add other flags
  if (Array.isArray(flags)) {
    for (const flagId of flags) {
      const flagConfig = FLOYD_FLAGS.find(f => f.id === flagId);
      if (flagConfig) {
        command += ` ${flagConfig.flag}`;
      }
    }
  }

  const sessionId = `floyd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    const result = await processManager.startProcess({
      command,
      cwd: cwd || process.cwd(),
      timeout: 0, // No timeout for interactive session
      env: buildFloyd4Env(), // Pass API key and config to Floyd4
    });

    // If initial prompt provided, send it
    if (prompt) {
      setTimeout(async () => {
        await processManager.interactWithProcess(sessionId, prompt);
      }, 2000); // Wait for Floyd4 to initialize
    }

    res.json({
      sessionId,
      pid: result.pid,
      command,
      status: 'started',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start Floyd4' });
  }
});

// Get Floyd4 session status (convenience endpoint)
app.get('/api/floyd/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const status = processManager.getSessionStatus(sessionId);
  
  if (!status) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    ...status,
    type: status.command.includes('floyd4') ? 'floyd' : 'cli',
  });
});

// Get CLI session status
app.get('/api/cli/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const status = processManager.getSessionStatus(sessionId);
  
  if (!status) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(status);
});

// Get CLI session output
app.get('/api/cli/output/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const result = processManager.readProcessOutput(sessionId, 500);
  
  if (result.output === 'Session not found') {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(result);
});

// Send input to CLI session (interactive)
app.post('/api/cli/interact/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { input } = req.body;

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Input is required' });
  }

  const result = await processManager.interactWithProcess(sessionId, input);
  
  if (!result.success) {
    return res.status(404).json({ error: result.output });
  }
  
  res.json(result);
});

// Terminate CLI session
app.delete('/api/cli/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const result = processManager.forceTerminate(sessionId);
  
  if (!result.success) {
    return res.status(404).json({ error: result.message });
  }
  
  res.json(result);
});

// List all CLI sessions
app.get('/api/cli/sessions', (req, res) => {
  const sessions = processManager.listSessions();
  res.json({ sessions });
});

// Get MCP server status
app.get('/api/mcp/status', (req, res) => {
  if (!mcpManager) {
    return res.json({ initialized: false, servers: [], totalTools: 0 });
  }
  const status = mcpManager.getStatus();
  res.json(status);
});

// Get all MCP tools
app.get('/api/mcp/tools', (req, res) => {
  if (!mcpManager) {
    return res.json({ tools: [] });
  }
  const tools = mcpManager.listAllTools();
  res.json({ tools });
});

// Convert built-in tools to Anthropic format
function getAnthropicTools(): Anthropic.Tool[] {
  const tools = [...BUILTIN_TOOLS];

  // Add MCP tools if manager is initialized
  if (mcpManager && mcpManager.getStatus().initialized) {
    const mcpTools = mcpManager.listAllTools();
    for (const mcpTool of mcpTools) {
      tools.push({
        name: mcpTool.name,
        description: mcpTool.description,
        input_schema: mcpTool.inputSchema as { type: 'object'; properties: Record<string, unknown>; required?: string[] },
      });
    }
  }

  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as { type: 'object'; properties: Record<string, unknown>; required?: string[] },
  })) as Anthropic.Tool[];
}

// Convert tools to OpenAI format
function getOpenAITools() {
  const tools = [...BUILTIN_TOOLS];

  // Add MCP tools if manager is initialized
  if (mcpManager && mcpManager.getStatus().initialized) {
    const mcpTools = mcpManager.listAllTools();
    for (const mcpTool of mcpTools) {
      tools.push({
        name: mcpTool.name,
        description: mcpTool.description,
        inputSchema: mcpTool.inputSchema,
      });
    }
  }

  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

// Send message (streaming with tool use) - supports both Anthropic and OpenAI
app.post('/api/chat/stream', async (req, res) => {
  const { sessionId, message, enableTools = true, attachments = [] } = req.body;

  if (!settings.apiKey) {
    return res.status(400).json({ error: 'API key not configured' });
  }

  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId || uuidv4(),
      title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
      created: Date.now(),
      updated: Date.now(),
      messages: [],
    };
    sessions.set(session.id, session);
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Build messages for API
  const apiMessages: any[] = [];

  // Add existing session messages
  for (const m of session.messages) {
    if (m.role === 'user' || m.role === 'assistant') {
      if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
        const contentBlocks: any[] = [];
        for (const attachment of m.attachments) {
          if (attachment.type === 'image') {
            if (settings.provider === 'glm' || settings.provider === 'openai') {
              contentBlocks.push({
                type: 'image_url',
                image_url: {
                  url: `data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.data}`
                }
              });
            } else {
              contentBlocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: attachment.mimeType || 'image/jpeg',
                  data: attachment.data,
                },
              });
            }
          } else if (attachment.type === 'document' || attachment.type === 'code') {
            if (settings.provider !== 'glm' && settings.provider !== 'openai') {
              contentBlocks.push({
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: attachment.mimeType || 'application/pdf',
                  data: attachment.data,
                },
              });
            }
          }
        }
        contentBlocks.push({ type: 'text', text: m.content });
        apiMessages.push({ role: m.role, content: contentBlocks });
      } else {
        apiMessages.push({ role: m.role, content: m.content });
      }
    }
  }

  // Build content for new user message with attachments
  let userContent: any = message;
  if (attachments && attachments.length > 0) {
    const contentBlocks: any[] = [];

    for (const attachment of attachments) {
      if (attachment.type === 'image') {
        console.log(`[Server] Processing image attachment: ${attachment.name}, type: ${attachment.mimeType}`);
        if (settings.provider === 'glm' || settings.provider === 'openai') {
          // OpenAI/GLM format
          const imageData = `data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.data}`;
          console.log(`[Server] GLM image data length: ${imageData.length} chars`);
          contentBlocks.push({
            type: 'image_url',
            image_url: {
              url: imageData
            }
          });
        } else {
          // Anthropic format
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: attachment.mimeType || 'image/jpeg',
              data: attachment.data,
            },
          });
        }
      } else if (attachment.type === 'document' || attachment.type === 'code') {
        console.log(`[Server] Processing document attachment: ${attachment.name}`);
        // Documents: for now, convert to text or skip (GLM may not support)
        if (settings.provider === 'glm' || settings.provider === 'openai') {
          // OpenAI doesn't have native document support, skip or convert
          console.log(`[Server] Skipping document for GLM/OpenAI provider`);
          continue;
        } else {
          contentBlocks.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: attachment.mimeType || 'application/pdf',
              data: attachment.data,
            },
          });
        }
      }
    }

    contentBlocks.push({
      type: 'text',
      text: message,
    });

    userContent = contentBlocks;
    console.log(`[Server] Final user content blocks for ${settings.provider}:`, JSON.stringify(contentBlocks, null, 2));
  }

  // Add new user message
  apiMessages.push({ role: 'user', content: userContent });
  session.messages.push({ 
    role: 'user', 
    content: message, 
    timestamp: Date.now(),
    attachments: attachments 
  });
  
  let fullResponse = '';
  let turnCount = 0;
  const maxTurns = 30; // Increased from 10 for better task completion
  
  // Build system prompt with skills and project context
  let systemPrompt = settings.systemPrompt || `You are Floyd v4.0.0, an AI assistant with multi-instance awareness.

## Multi-Instance Awareness

You are ONE instance in the Floyd mesh. Other Floyd instances exist:
- CLI Floyd: Terminal-based, full MCP toolset (98+ tools)
- Mobile Floyd: PWA at floyd-mobile.ngrok-free.app
- IDE Floyd: VS Code integration (FLOYD CURSE'M app)
- Harness Floyd: Background automation service

All instances share SUPERCACHE and can communicate.

## Your Role (Desktop/Web Instance)

You are the Desktop/Web interface for Floyd. You have:
- Browser automation (screenshot, navigation, interaction)
- File operations (read, write, search)
- Command execution tools
- Visual chat interface with streaming
- MCP tools integration (12 servers, 45+ tools)

## Communication Between Instances

You can communicate with other Floyd instances via:
1. SUPERCACHE: Use cache_store/cache_retrieve with shared keys
2. User-mediated: Ask user to pass messages to CLI Floyd

Examples:
- "Store this in SUPERCACHE for CLI Floyd: cache_store(key='cross:task', value='...')"
- "Check SUPERCACHE for messages from CLI Floyd: cache_retrieve(key='cross:response')"

## Available MCP Tools

Your Desktop instance has these MCP servers:
- floyd-patch (5 tools): edit_range, apply_unified_diff, insert_at, delete_range
- floyd-runner (6 tools): detect_project, run_tests, format, lint, build
- floyd-git (7 tools): git_status, git_diff, git_log, git_commit, git_stage
- floyd-explorer (5 tools): project_map, read_file, list_symbols, smart_replace
- floyd-supercache (12 tools): cache_store, cache_retrieve, cache_search, cache_store_pattern
- floyd-devtools (6 tools): dependency_analyzer, typescript_semantic_analyzer
- floyd-terminal (9 tools): start_process, interact_with_process, list_processes
- floyd-safe-ops (3 tools): impact_simulate, safe_operation, verify_operation
- novel-concepts (10 tools): generate_concept, explore_idea, brainstorm
- External ZAI tools: analyze_image, webSearchPrime, webReader, zread

## Personality

Be direct, helpful, and technically competent. No excessive emoji or generic AI phrases.
You're part of a unified AI system, not a standalone chatbot.
Acknowledge your role as Desktop Floyd when relevant.`;
  
  // Add active skills
  const skillsContext = skillsManager.getSystemPromptAdditions();
  if (skillsContext) {
    systemPrompt += skillsContext;
  }
  
  // Add project context
  const projectContext = await projectsManager.getProjectContext();
  if (projectContext) {
    systemPrompt += projectContext;
  }
  
  try {
    if (settings.provider === 'openai' || settings.provider === 'glm') {
      // OpenAI-compatible flow (OpenAI and GLM)
      const client = new OpenAI({ 
        apiKey: settings.apiKey,
        baseURL: settings.baseURL, // Use consistent endpoint
      });
      const openaiTools = enableTools ? getOpenAITools() : undefined;
      
      console.log(`[Server] Making ${settings.provider} API request:`, {
        model: settings.model,
        baseURL: settings.baseURL,
        hasAttachments: attachments && attachments.length > 0,
        messageCount: apiMessages.length,
        toolsEnabled: !!openaiTools
      });
      
      while (turnCount < maxTurns) {
        turnCount++;
        
        const response = await client.chat.completions.create({
          model: settings.model,
          max_tokens: settings.maxTokens || 16384,
          messages: [
            { role: 'system', content: systemPrompt },
            ...apiMessages,
          ],
          tools: openaiTools,
          temperature: settings.temperature || 0.1,
        });
        
        const choice = response.choices[0];
        const assistantMessage = choice.message;
        
        // Handle thinking/reasoning content (GLM models)
        const anyMessage = assistantMessage as any;
        if (anyMessage.reasoning_content) {
          res.write(`data: ${JSON.stringify({ type: 'thinking', content: anyMessage.reasoning_content })}\n\n`);
        }
        
        // Handle text content
        if (assistantMessage.content) {
          fullResponse += assistantMessage.content;
          res.write(`data: ${JSON.stringify({ type: 'text', content: assistantMessage.content })}\n\n`);
        }
        
        // Handle tool calls
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          apiMessages.push(assistantMessage);
          
          for (const toolCall of assistantMessage.tool_calls) {
            // Type narrowing: only function-type calls have the .function property
            if (toolCall.type !== 'function') continue;
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            // Send tool call info to client
            res.write(`data: ${JSON.stringify({ 
              type: 'tool_call', 
              tool: toolName, 
              args: toolArgs,
              id: toolCall.id 
            })}\n\n`);
            
            // Execute tool
            let result;
            if (mcpManager && toolName.includes(':')) {
              // This is an MCP tool
              try {
                result = await mcpManager.callTool(toolName, toolArgs);
                result = { success: true, result };
              } catch (error: any) {
                result = { success: false, error: error.message };
              }
            } else {
              // Built-in tool
              result = await toolExecutor.execute(toolName, toolArgs);
            }

            // Check if result contains an image (screenshot)
            const isImageResult = result.success && result.result?.image;

            // Send tool result to client
            if (isImageResult) {
              // Send image as a special event type
              res.write(`data: ${JSON.stringify({
                type: 'image',
                tool: toolName,
                id: toolCall.id,
                data: result.result.image,
                format: result.result.format || 'png',
                mimeType: result.result.mimeType || 'image/png',
              })}\n\n`);
            }

            res.write(`data: ${JSON.stringify({
              type: 'tool_result',
              tool: toolName,
              id: toolCall.id,
              result: isImageResult ? { screenshot: 'Image captured and sent to client' } : (result.success ? result.result : { error: result.error }),
              success: result.success
            })}\n\n`);

            // Add tool result to messages - don't include image data to avoid context overflow
            apiMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(isImageResult ? { screenshot: 'Image captured successfully' } : (result.success ? result.result : { error: result.error })),
            });
          }
        } else {
          // No tool calls, we're done
          break;
        }
        
        if (choice.finish_reason === 'stop') {
          break;
        }
      }
    } else {
      // Anthropic-compatible flow (uses Anthropic client with custom baseURL)
      const client = new Anthropic({ 
        apiKey: settings.apiKey,
        baseURL: settings.baseURL,
      });
      const anthropicTools = enableTools ? getAnthropicTools() : undefined;
      
      while (turnCount < maxTurns) {
        turnCount++;
        
        const response = await client.messages.create({
          model: settings.model,
          max_tokens: settings.maxTokens || 16384,
          system: systemPrompt,
          temperature: settings.temperature || 0.1,
          messages: apiMessages,
          tools: anthropicTools,
        });
        
        // Process response content
        let hasToolUse = false;
        const toolResults: any[] = [];
        
        for (const block of response.content) {
          if (block.type === 'text') {
            fullResponse += block.text;
            res.write(`data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`);
          } else if (block.type === 'tool_use') {
            hasToolUse = true;
            
            // Send tool call info to client
            res.write(`data: ${JSON.stringify({ 
              type: 'tool_call', 
              tool: block.name, 
              args: block.input,
              id: block.id 
            })}\n\n`);
            
            // Execute tool
            let result;
            if (mcpManager && block.name.includes(':')) {
              // This is an MCP tool
              try {
                result = await mcpManager.callTool(block.name, block.input as Record<string, unknown>);
                result = { success: true, result };
              } catch (error: any) {
                result = { success: false, error: error.message };
              }
            } else {
              // Built-in tool
              result = await toolExecutor.execute(block.name, block.input as Record<string, unknown>);
            }

            // Check if result contains an image (screenshot)
            const isImageResult = result.success && result.result?.image;

            // Send image as a special event type
            if (isImageResult) {
              res.write(`data: ${JSON.stringify({
                type: 'image',
                tool: block.name,
                id: block.id,
                data: result.result.image,
                format: result.result.format || 'png',
                mimeType: result.result.mimeType || 'image/png',
              })}\n\n`);
            }

            // Send tool result to client
            res.write(`data: ${JSON.stringify({
              type: 'tool_result',
              tool: block.name,
              id: block.id,
              result: isImageResult ? { screenshot: 'Image captured and sent to client' } : (result.success ? result.result : { error: result.error }),
              success: result.success
            })}\n\n`);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(isImageResult ? { screenshot: 'Image captured successfully' } : (result.success ? result.result : { error: result.error })),
            });
          }
        }
        
        // Add assistant message to conversation
        apiMessages.push({ role: 'assistant', content: response.content });
        
        // If tool was used, add results and continue
        if (hasToolUse && toolResults.length > 0) {
          apiMessages.push({ role: 'user', content: toolResults });
        } else {
          break;
        }
        
        if (response.stop_reason === 'end_turn') {
          break;
        }
      }
    }
    
    // Save final response to session
    if (fullResponse) {
      session.messages.push({
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      });
    }
    session.updated = Date.now();
    await saveSession(session);
    
    res.write(`data: ${JSON.stringify({ 
      type: 'done', 
      sessionId: session.id,
      turns: turnCount
    })}\n\n`);
    res.end();
    
  } catch (error: any) {
    console.error('[Server] Stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// SPA catch-all - serve index.html for non-API routes
app.get('*', (req, res) => {
  // Don't catch API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Global error handler - catches all unhandled errors in async routes
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err.message);
  console.error('[Server] Stack:', err.stack);
  console.error('[Server] Route:', req.method, req.path);
  
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
});

// Start server
const PORT = process.env.PORT || 3001;

// Also start WebSocket MCP server for Chrome extension
initDataDir().then(async () => {
  // Start Express API server
  app.listen(PORT, () => {
    console.log(`[Floyd Web Server] Running on http://localhost:${PORT}`);
    console.log(`[Floyd Web Server] API Key: ${settings.apiKey ? 'Configured' : 'NOT SET'}`);
  });

  // Start WebSocket MCP server for Chrome extension
  try {
    wsMcpServer = new WebSocketMCPServer(3005);
    wsMcpServer.registerTools([...BUILTIN_TOOLS]);
    await wsMcpServer.start();
    console.log('[Floyd Web Server] WebSocket MCP server started on port 3005 for Chrome extension');

    // Wire wsMcpServer to toolExecutor for browser automation tools
    toolExecutor.setWsMcpServer(wsMcpServer);
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      console.log('[Floyd Web Server] Port 3005 already in use - WebSocket MCP server not started');
      console.log('[Floyd Web Server] Chrome extension will connect to existing MCP server');
    } else {
      console.error('[Floyd Web Server] Failed to start WebSocket MCP server:', error);
    }
  }
});
