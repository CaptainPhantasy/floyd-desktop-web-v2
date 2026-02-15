# Floyd Desktop

AI Assistant Web Application with multi-provider support, tool execution, and browser automation.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (client + server)
npm run dev

# Open http://localhost:3001
```

**First Chat:**
1. Open Settings (gear icon)
2. Select a provider and enter your API key
3. Click "New Chat" and start messaging

## Access Methods

| Method | Command/URL | Use Case |
|--------|-------------|----------|
| **Web UI** | http://localhost:3001 | Full-featured interface |
| **CLI Client** | `./floyd-cli` | Terminal-based chat |
| **REST API** | http://localhost:3001/api/* | Integration |

## Features

### Multi-Provider AI

| Provider | Models | API Key Env Var |
|----------|--------|-----------------|
| **Anthropic** | Claude 4.5 Opus, Claude 4.5 Sonnet, Claude 3.5 Haiku | `ANTHROPIC_API_KEY` |
| **OpenAI** | GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo | `OPENAI_API_KEY` |
| **Z.ai GLM** | GLM-4.7, GLM-4 Plus, GLM-4 Flash | `GLM_API_KEY` |
| **Custom** | Any Anthropic-compatible endpoint | Varies |

### Tool Execution (41 Tools)

**File System:** read_file, write_file, list_directory, search_files, create_directory, delete_file, move_file, get_file_info, edit_block

**Commands:** execute_command, start_process, interact_with_process, read_process_output, force_terminate, list_processes, kill_process

**Code:** execute_code (Python, Node.js, Bash)

**Browser:** browser_navigate, browser_screenshot, browser_read_page, browser_click, browser_type, browser_get_tabs

**Superpowers:** project_map, smart_replace, semantic_search, dependency_xray, visual_verify, todo_sniper

**Cache:** cache_store, cache_retrieve, cache_search

### Session Management

- Persistent chat history stored in `.floyd-data/sessions/`
- Custom renaming and titles
- Pin important sessions
- Organize with folders
- Archive old conversations
- Regenerate responses
- Edit messages with cascade

### Skills System

Pre-built skills for common tasks:
- Code Review
- Refactoring Assistant
- Debug Detective
- And 10+ more...

Create custom skills with triggers and instructions.

### Projects

Organize work by project with:
- Context files and snippets
- Active project switching
- System prompt injection

### Browork (Background Tasks)

Run AI tasks in the background with status tracking.

## CLI Client

Terminal-based access with image support:

```bash
# Connect to default server
./floyd-cli

# Connect to custom server
./floyd-cli http://your-server:3001

# Set via environment variable
FLOYD_SERVER_URL=http://remote:3001 ./floyd-cli
```

**Commands:**
```
help                 Show available commands
exit / quit          Exit the client
screenshot <url>     Capture website screenshot
clear                Clear screen
```

**Image Display:** Works in iTerm2, Kitty, and saves to temp file for other terminals.

## Browser Automation

### Puppeteer Screenshots (Built-in)

The `browser_screenshot` tool uses Puppeteer directly - no extension needed:

```
User: Take a screenshot of https://example.com
AI: [Uses browser_screenshot tool, returns image]
```

### Chrome Extension (Advanced)

For full browser control (click, type, navigate):

1. Install the Floyd Chrome Extension
2. It connects to `ws://localhost:3005`
3. Enables: browser_click, browser_type, browser_navigate, browser_read_page

## Environment Variables

Create `.env.local` in the project root:

```env
# Primary API key (required)
ANTHROPIC_API_KEY=sk-ant-...

# Alternative providers
OPENAI_API_KEY=sk-...
GLM_API_KEY=...

# Custom endpoint (optional)
ANTHROPIC_BASE_URL=https://custom-endpoint.com/v1

# Server port (default: 3001)
PORT=3001
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status |
| `/api/providers` | GET | Available providers and models |
| `/api/settings` | GET/POST | View/update settings |
| `/api/sessions` | GET/POST | List/create sessions |
| `/api/sessions/:id` | GET/PUT/DELETE | Manage session |
| `/api/sessions/:id/rename` | PATCH | Rename session |
| `/api/sessions/:id/pin` | PATCH | Pin/unpin session |
| `/api/sessions/:id/folder` | PATCH | Assign to folder |
| `/api/sessions/:id/archive` | PATCH | Archive/unarchive |
| `/api/sessions/:id/regenerate` | POST | Regenerate last response |
| `/api/sessions/:id/continue` | POST | Continue truncated response |
| `/api/chat` | POST | Send message (non-streaming) |
| `/api/chat/stream` | POST | Send message (SSE streaming) |
| `/api/tools` | GET | List available tools |
| `/api/tools/execute` | POST | Execute a tool directly |
| `/api/skills` | GET/POST | List/create skills |
| `/api/skills/:id/activate` | POST | Activate skill |
| `/api/projects` | GET/POST | List/create projects |
| `/api/browork/tasks` | GET/POST | Background task management |

Full API documentation: [docs/api/rest-api.md](docs/api/rest-api.md)

## Development

```bash
# Development (hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with UI
npm run test:ui
```

**Tech Stack:**
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- Backend: Express, TypeScript
- AI SDKs: Anthropic SDK, OpenAI SDK
- Browser: Puppeteer
- Testing: Vitest, Playwright

## Project Structure

```
├── src/                    # React client
│   ├── components/         # UI components
│   ├── hooks/              # React hooks
│   ├── lib/                # Utilities
│   ├── theme/              # Theme configuration
│   └── types/              # TypeScript types
├── server/                 # Express backend
│   ├── index.ts            # Main server
│   ├── tool-executor.ts    # Tool execution
│   ├── mcp-client.ts       # MCP client + builtin tools
│   ├── ws-mcp-server.ts    # WebSocket for Chrome
│   ├── skills-manager.ts   # Skills system
│   ├── projects-manager.ts # Projects system
│   └── browork-manager.ts  # Background tasks
├── docs/                   # Documentation
├── .floyd-data/            # User data (sessions, settings)
├── cli-client.js           # CLI client
└── floyd-cli               # CLI wrapper script
```

## Documentation

- [Getting Started](docs/guides/getting-started.md)
- [CLI Client Guide](docs/guides/cli-client.md)
- [Browser Automation](docs/guides/browser-automation.md)
- [Tools Reference](docs/reference/tools.md)
- [Configuration](docs/reference/configuration.md)
- [REST API Reference](docs/api/rest-api.md)

## Troubleshooting

**API key not working:**
- Verify key format matches provider
- Check key hasn't expired
- Use Settings > Test Key to validate

**Port already in use:**
```bash
# Find process on port
lsof -i :3001
# Kill it
kill -9 <PID>
```

**Chrome extension not connecting:**
- Verify WebSocket server is running on port 3005
- Check browser console for connection errors

## License

MIT License - see [LICENSE](LICENSE)

## Governing Document

See [FLOYD.MD](FLOYD.MD) for repository governance.
