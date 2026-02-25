/**
 * MCP Client - Connects to MCP servers like Desktop Commander
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private tools: MCPTool[] = [];
  private requestId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private buffer = '';
  public connected = false;
  public serverName: string;

  constructor(private config: MCPServerConfig) {
    super();
    this.serverName = config.name;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args || [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.config.env },
        });

        this.process.stdout?.on('data', (data) => {
          this.handleData(data.toString());
        });

        this.process.stderr?.on('data', (data) => {
          console.error(`[MCP ${this.serverName}] stderr:`, data.toString());
        });

        this.process.on('error', (err) => {
          console.error(`[MCP ${this.serverName}] error:`, err);
          this.connected = false;
          reject(err);
        });

        this.process.on('close', (code) => {
          console.log(`[MCP ${this.serverName}] closed with code ${code}`);
          this.connected = false;
        });

        // Initialize connection
        setTimeout(async () => {
          try {
            await this.initialize();
            this.connected = true;
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 500);
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleData(data: string) {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch {
        // Not JSON, ignore
      }
    }
  }

  private handleMessage(message: any) {
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        reject(new Error(message.error.message || 'MCP error'));
      } else {
        resolve(message.result);
      }
    }
  }

  private sendRequest(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(request) + '\n');

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('MCP request timeout'));
        }
      }, 30000);
    });
  }

  private async initialize(): Promise<void> {
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'floyd-desktop',
        version: '0.1.0',
      },
    });

    // Get available tools
    const result = await this.sendRequest('tools/list');
    this.tools = result.tools || [];
    console.log(`[MCP ${this.serverName}] Connected with ${this.tools.length} tools`);
  }

  async listTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    return result;
  }

  disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
  }
}

// Built-in tools - Desktop Commander compatible
export const BUILTIN_TOOLS = [
  // === FILE SYSTEM TOOLS ===
  {
    name: 'read_file',
    description: 'Read contents of a file with optional line-based pagination. Supports negative offset to read from end of file (like tail).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
        offset: { type: 'number', description: 'Line offset (negative reads from end like tail -n)' },
        limit: { type: 'number', description: 'Maximum lines to read (default 1000)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write contents to a file. Creates parent directories if needed.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
        append: { type: 'boolean', description: 'Append instead of overwrite' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: 'Get detailed listing of files and directories with size and modification time.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name pattern and/or content. Uses glob patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to search in' },
        pattern: { type: 'string', description: 'Glob pattern for file names (e.g., "*.ts", "**/*.json")' },
        content: { type: 'string', description: 'Search for this text within files' },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a new directory or ensure it exists (mkdir -p).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to create' },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file or directory (recursive for directories).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete' },
      },
      required: ['path'],
    },
  },
  {
    name: 'move_file',
    description: 'Move or rename a file/directory.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' },
      },
      required: ['source', 'destination'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Get detailed metadata about a file or directory.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File or directory path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'edit_block',
    description: 'Apply surgical text replacement in a file. Use for small, focused edits. Supports fuzzy matching fallback.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to edit' },
        search: { type: 'string', description: 'Exact text to find and replace' },
        replace: { type: 'string', description: 'New text to insert' },
        expected_replacements: { type: 'number', description: 'Expected number of replacements (default 1, use -1 for all)' },
      },
      required: ['path', 'search', 'replace'],
    },
  },

  // === COMMAND EXECUTION ===
  {
    name: 'execute_command',
    description: 'Execute a shell command and wait for completion. For long-running commands, use start_process instead.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        cwd: { type: 'string', description: 'Working directory' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
      },
      required: ['command'],
    },
  },

  // === PROCESS/SESSION MANAGEMENT ===
  {
    name: 'start_process',
    description: 'Start a long-running process (SSH, database, dev server, etc.) and return a session ID for interaction.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to start' },
        cwd: { type: 'string', description: 'Working directory' },
        shell: { type: 'string', description: 'Shell to use (default: bash)' },
        timeout: { type: 'number', description: 'Initial output wait timeout in ms' },
      },
      required: ['command'],
    },
  },
  {
    name: 'interact_with_process',
    description: 'Send input to a running process/session and get the response.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID from start_process' },
        input: { type: 'string', description: 'Input to send to the process' },
      },
      required: ['session_id', 'input'],
    },
  },
  {
    name: 'read_process_output',
    description: 'Read output from a running process without sending input.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID from start_process' },
        lines: { type: 'number', description: 'Number of lines to read (default: all)' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'force_terminate',
    description: 'Force terminate a running process/session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID to terminate' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'list_sessions',
    description: 'List all active terminal sessions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_processes',
    description: 'List all running system processes with CPU/memory info.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kill_process',
    description: 'Terminate a running process by PID.',
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID to terminate' },
      },
      required: ['pid'],
    },
  },

  // === CODE EXECUTION ===
  {
    name: 'execute_code',
    description: 'Execute code in memory without saving to a file. Supports Python, Node.js, and Bash.',
    inputSchema: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['python', 'node', 'bash'], description: 'Programming language' },
        code: { type: 'string', description: 'Code to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
      },
      required: ['language', 'code'],
    },
  },

  // === EXPLORER TOOLS (Superpowers) ===
  {
    name: 'project_map',
    description: 'Get a compressed directory tree of the codebase to understand project structure (spatial awareness).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to map (defaults to current)' },
        maxDepth: { type: 'number', description: 'Maximum depth of the tree (default: 3)' },
        ignorePatterns: { type: 'array', items: { type: 'string' }, description: 'Patterns to ignore' },
      },
    },
  },
  {
    name: 'smart_replace',
    description: 'Surgical search and replace. Replaces a unique block of text with new content (robust surgical editing).',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the file' },
        searchString: { type: 'string', description: 'The exact text block to find' },
        replaceString: { type: 'string', description: 'The new text block' },
        dryRun: { type: 'boolean', description: 'Preview change without applying' },
      },
      required: ['filePath', 'searchString', 'replaceString'],
    },
  },
  {
    name: 'list_symbols',
    description: 'List structural symbols (classes, functions, interfaces) in a file to build a mental map.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the file' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'semantic_search',
    description: 'Deep context search. Finds code by concept (e.g., "authentication logic") rather than literal strings.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The concept or feature to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_diagnostics',
    description: 'Run compiler/linter diagnostics (Rust/TS) to detect and self-correct errors.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'fetch_docs',
    description: 'Fetch and read external documentation from a URL using Jina Reader.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL of the documentation' },
      },
      required: ['url'],
    },
  },
  {
    name: 'dependency_xray',
    description: 'Dive into the source code of an installed package (node_modules) to understand its implementation.',
    inputSchema: {
      type: 'object',
      properties: {
        packageName: { type: 'string', description: 'Name of the package to examine' },
      },
      required: ['packageName'],
    },
  },
  {
    name: 'visual_verify',
    description: 'Run a command briefly and capture terminal output. Essential for verifying TUI/CLI alignment and padding.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to run (e.g., "npm run dev")' },
        timeoutMs: { type: 'number', description: 'How long to run before capturing (default 2000ms)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'todo_sniper',
    description: 'Scan the codebase for TODO, FIXME, and HACK comments to identify tech debt.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // === NOVEL TOOLS (SINGULARITY) ===
  {
    name: 'runtime_schema_gen',
    description: 'Generate Types/Zod schemas from live API/JSON data (Truth Seeker).',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'URL or file path' },
        type: { type: 'string', enum: ['url', 'file'], description: 'Source type' },
      },
      required: ['source', 'type'],
    },
  },
  {
    name: 'tui_puppeteer',
    description: 'Simulate user interaction (keys) with a TUI app (Ghost User).',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run' },
        keys: { type: 'array', items: { type: 'string' }, description: 'Sequence of keys to send' },
      },
      required: ['command', 'keys'],
    },
  },
  {
    name: 'ast_navigator',
    description: 'Find definitions or references of symbols using smart search (Brain Surgeon).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol to find' },
        type: { type: 'string', enum: ['def', 'refs'], description: 'Search type' },
      },
      required: ['query', 'type'],
    },
  },
  {
    name: 'skill_crystallizer',
    description: 'Save a code pattern or solution to long-term memory (Learning Mechanism).',
    inputSchema: {
      type: 'object',
      properties: {
        skillName: { type: 'string', description: 'Name of the skill' },
        filePath: { type: 'string', description: 'Source file of the pattern' },
        description: { type: 'string', description: 'Description of what this skill solves' },
      },
      required: ['skillName', 'filePath', 'description'],
    },
  },

  // === AGENT MEMORY & PLANNING (Superpowers) ===
  {
    name: 'manage_scratchpad',
    description: 'Manage a persistent scratchpad for planning and task tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['read', 'write', 'append', 'clear'],
          description: 'Action to perform' 
        },
        content: { 
          type: 'string', 
          description: 'Content to write or append (required for write/append)' 
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'cache_store',
    description: 'Store data to a cache tier (reasoning, project, or vault).',
    inputSchema: {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['reasoning', 'project', 'vault'], description: 'Cache tier' },
        key: { type: 'string', description: 'Unique key' },
        value: { type: 'string', description: 'Value to store' },
      },
      required: ['tier', 'key', 'value'],
    },
  },
  {
    name: 'cache_retrieve',
    description: 'Retrieve data from a cache tier by key.',
    inputSchema: {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['reasoning', 'project', 'vault'], description: 'Cache tier' },
        key: { type: 'string', description: 'Key to retrieve' },
      },
      required: ['tier', 'key'],
    },
  },
  {
    name: 'cache_search',
    description: 'Search for entries in a cache tier.',
    inputSchema: {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['reasoning', 'project', 'vault'], description: 'Cache tier' },
        query: { type: 'string', description: 'Search query' },
      },
      required: ['tier', 'query'],
    },
  },

  // === BROWSER AUTOMATION (Chrome Extension) ===
  {
    name: 'browser_navigate',
    description: 'Navigate the browser to a specific URL.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_read_page',
    description: 'Get the accessibility tree and semantic structure of the current page.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element on the page by selector or coordinates.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        x: { type: 'number', description: 'X coordinate (optional)' },
        y: { type: 'number', description: 'Y coordinate (optional)' },
      },
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into the currently focused element or a specific selector.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to type' },
        selector: { type: 'string', description: 'CSS selector (optional)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'browser_get_tabs',
    description: 'List all open tabs in the browser.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of a web page using Puppeteer. Returns a base64-encoded PNG image.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to screenshot (required if no browser is connected)' },
        width: { type: 'number', description: 'Viewport width in pixels (default 1280)' },
        height: { type: 'number', description: 'Viewport height in pixels (default 720)' },
        fullPage: { type: 'boolean', description: 'Capture full scrollable page (default false)' },
        selector: { type: 'string', description: 'CSS selector to screenshot specific element' },
      },
    },
  },
  {
    name: 'browser_get_page_state',
    description: 'Get comprehensive page state including DOM structure, cookies, localStorage, sessionStorage, scroll position, and form data. Useful for debugging and state capture.',
    inputSchema: {
      type: 'object',
      properties: {
        includeDOM: { type: 'boolean', description: 'Include DOM structure (default: true)' },
        includeCookies: { type: 'boolean', description: 'Include cookies (default: true)' },
        includeLocalStorage: { type: 'boolean', description: 'Include localStorage (default: true)' },
        includeSessionStorage: { type: 'boolean', description: 'Include sessionStorage (default: true)' },
        includeScrollPosition: { type: 'boolean', description: 'Include scroll position (default: true)' },
        includeFormData: { type: 'boolean', description: 'Include form data (default: true)' },
        selector: { type: 'string', description: 'CSS selector to limit DOM capture (optional)' },
      },
    },
  },

  // === VISION TOOLS (Tom the Peep - Floyd Vision Agent) ===
  {
    name: 'browser_analyze_page',
    description: 'Full page audit: layout structure, accessibility violations, CSS layout systems, contrast issues, images, forms, interactive elements, and overall quality score (0-100). This is how non-vision LLMs "see" a web page.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: 'Tab ID (optional, uses active tab)' },
        includeCss: { type: 'boolean', description: 'Include CSS layout analysis (default true)' },
        includeA11y: { type: 'boolean', description: 'Include accessibility audit (default true)' },
      },
    },
  },
  {
    name: 'browser_analyze_element',
    description: 'Deep inspection of a single element: all computed CSS styles, position, dimensions, accessibility attributes, children count, and every HTML attribute.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element' },
        tabId: { type: 'number', description: 'Tab ID (optional)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_find_elements',
    description: 'Search for elements by visible text, aria-label, placeholder, alt text, or role. Use when you know what something says but not its CSS selector.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for (e.g. "Login", "Submit")' },
        searchBy: { type: 'string', description: '"text", "aria", "placeholder", "alt", "role", or "any" (default "any")' },
        limit: { type: 'number', description: 'Max results (default 10)' },
        tabId: { type: 'number', description: 'Tab ID (optional)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'browser_check_contrast',
    description: 'Check color contrast ratios for WCAG AA compliance. Walks up DOM tree to find effective background. Returns failing elements with exact ratios and required minimums.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to check (default: all text elements)' },
        tabId: { type: 'number', description: 'Tab ID (optional)' },
      },
    },
  },
  {
    name: 'browser_extract_css',
    description: 'Extract computed CSS properties for an element. Returns all visual styling: colors, fonts, spacing, layout, transforms, animations.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        properties: { type: 'string', description: 'Comma-separated CSS properties to extract (default: all relevant)' },
        tabId: { type: 'number', description: 'Tab ID (optional)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_scroll_to',
    description: 'Scroll to an element or position. Supports CSS selectors or "top", "bottom", "up", "down".',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'CSS selector or "top"/"bottom"/"up"/"down"' },
        tabId: { type: 'number', description: 'Tab ID (optional)' },
      },
      required: ['target'],
    },
  },
] as const;

// ============================================================================
// MCP MANAGER - Manages multiple MCP servers
// ============================================================================

interface MCPManagerConfig {
  name: string;
  command: string;
  args?: string[];
  enabled: boolean;
}

interface MCPServerConfigFile {
  version: string;
  generated: string;
  description: string;
  servers: MCPManagerConfig[];
}

export class MCPManager extends EventEmitter {
  private servers: Map<string, MCPClient> = new Map();
  private configs: Map<string, MCPManagerConfig> = new Map();
  private tools: Map<string, MCPTool[]> = new Map();
  private allTools: MCPTool[] = [];
  private initialized = false;

  /**
   * Load MCP server configurations from JSON file
   */
  async loadConfig(configPath: string): Promise<void> {
    try {
      const configContent = await import('fs').then(fs => fs.promises.readFile(configPath, 'utf-8'));
      const config: MCPServerConfigFile = JSON.parse(configContent);

      console.log(`[MCPManager] Loading ${config.servers.length} servers from ${configPath}`);

      for (const serverConfig of config.servers) {
        this.configs.set(serverConfig.name, serverConfig);
      }

      console.log(`[MCPManager] Configurations loaded for: ${Array.from(this.configs.keys()).join(', ')}`);
    } catch (error) {
      console.error(`[MCPManager] Failed to load config from ${configPath}:`, error);
      throw error;
    }
  }

  /**
   * Start all enabled MCP servers
   */
  async startAll(): Promise<void> {
    console.log('[MCPManager] Starting all MCP servers...');

    const startPromises: Promise<void>[] = [];

    for (const [name, config] of this.configs.entries()) {
      if (config.enabled) {
        const startPromise = this.startServer(name, config);
        startPromises.push(startPromise);
      } else {
        console.log(`[MCPManager] Skipping disabled server: ${name}`);
      }
    }

    await Promise.allSettled(startPromises);

    // Aggregate all tools from all servers
    this.aggregateTools();

    this.initialized = true;

    console.log(`[MCPManager] Initialization complete. Active servers: ${this.servers.size}, Total tools: ${this.allTools.length}`);
    this.emit('ready', {
      serverCount: this.servers.size,
      toolCount: this.allTools.length,
      servers: Array.from(this.servers.keys())
    });
  }

  /**
   * Start a single MCP server
   */
  private async startServer(name: string, config: MCPManagerConfig): Promise<void> {
    try {
      console.log(`[MCPManager] Starting server: ${name}`);

      const client = new MCPClient({
        name: config.name,
        command: config.command,
        args: config.args || [],
      });

      await client.connect();
      const tools = await client.listTools();

      this.servers.set(name, client);
      this.tools.set(name, tools);

      console.log(`[MCPManager] ✓ ${name} connected with ${tools.length} tools`);
    } catch (error) {
      console.error(`[MCPManager] ✗ Failed to start ${name}:`, error);
      // Continue starting other servers even if one fails
    }
  }

  /**
   * Aggregate all tools from all connected servers
   */
  private aggregateTools(): void {
    this.allTools = [];

    for (const [serverName, serverTools] of this.tools.entries()) {
      // Add server prefix to tool names to avoid conflicts
      const prefixedTools = serverTools.map(tool => ({
        ...tool,
        name: `${serverName}:${tool.name}`,
        originalName: tool.name,
        serverName
      }));
      this.allTools.push(...prefixedTools);
    }

    console.log(`[MCPManager] Aggregated ${this.allTools.length} total tools from ${this.tools.size} servers`);
  }

  /**
   * Get all tools from all connected servers
   */
  listAllTools(): MCPTool[] {
    return this.allTools;
  }

  /**
   * Get tools from a specific server
   */
  listServerTools(serverName: string): MCPTool[] {
    return this.tools.get(serverName) || [];
  }

  /**
   * Get all connected server names
   */
  getServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * Get connection status for a server
   */
  isServerConnected(serverName: string): boolean {
    const client = this.servers.get(serverName);
    return client ? client.connected : false;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<any> {
    // Parse tool name to extract server name and actual tool name
    const [serverName, ...nameParts] = toolName.split(':');
    const actualToolName = nameParts.join(':');

    if (!serverName || nameParts.length === 0) {
      throw new Error(`Invalid tool name format: ${toolName}. Expected format: server:tool_name`);
    }

    const client = this.servers.get(serverName);
    if (!client || !client.connected) {
      throw new Error(`Server ${serverName} is not connected`);
    }

    try {
      return await client.callTool(actualToolName, args);
    } catch (error) {
      console.error(`[MCPManager] Tool call failed: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * Stop all MCP servers
   */
  stopAll(): void {
    console.log('[MCPManager] Stopping all MCP servers...');

    for (const [name, client] of this.servers.entries()) {
      try {
        client.disconnect();
        console.log(`[MCPManager] ✓ ${name} stopped`);
      } catch (error) {
        console.error(`[MCPManager] ✗ Failed to stop ${name}:`, error);
      }
    }

    this.servers.clear();
    this.tools.clear();
    this.allTools = [];
    this.initialized = false;

    console.log('[MCPManager] All servers stopped');
  }

  /**
   * Stop a specific server
   */
  stopServer(serverName: string): void {
    const client = this.servers.get(serverName);
    if (client) {
      client.disconnect();
      this.servers.delete(serverName);
      this.tools.delete(serverName);
      this.aggregateTools();
      console.log(`[MCPManager] Stopped server: ${serverName}`);
    }
  }

  /**
   * Restart a specific server
   */
  async restartServer(serverName: string): Promise<void> {
    const config = this.configs.get(serverName);
    if (!config) {
      throw new Error(`No configuration found for server: ${serverName}`);
    }

    this.stopServer(serverName);
    await this.startServer(serverName, config);
    this.aggregateTools();
  }

  /**
   * Get status of all servers
   */
  getStatus(): {
    initialized: boolean;
    servers: Array<{ name: string; connected: boolean; toolCount: number }>;
    totalTools: number;
  } {
    const servers = Array.from(this.configs.keys()).map(name => ({
      name,
      connected: this.isServerConnected(name),
      toolCount: this.listServerTools(name).length
    }));

    return {
      initialized: this.initialized,
      servers,
      totalTools: this.allTools.length
    };
  }
}
