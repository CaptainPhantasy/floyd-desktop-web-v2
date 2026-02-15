# Configuration Reference

Complete guide to configuring Floyd Desktop.

## Environment Variables

Create a `.env.local` file in the project root:

```env
# === API Keys (at least one required) ===

# Anthropic (Claude models)
ANTHROPIC_API_KEY=sk-ant-api03-...

# OpenAI (GPT models)
OPENAI_API_KEY=sk-proj-...

# Z.ai GLM (GLM models)
GLM_API_KEY=...

# === Server Configuration ===

# HTTP server port (default: 3001)
PORT=3001

# WebSocket MCP server port for Chrome extension (default: 3005)
WS_MCP_PORT=3005

# === Custom Endpoints ===

# Override Anthropic base URL (for custom endpoints)
ANTHROPIC_BASE_URL=https://custom-endpoint.com/v1
```

## Settings API

Settings can also be configured via the Web UI or REST API.

### GET /api/settings

View current settings.

### POST /api/settings

Update settings:

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-5-20250514",
  "systemPrompt": "You are a helpful assistant.",
  "maxTokens": 8192,
  "baseURL": "https://api.anthropic.com"
}
```

## Provider Configuration

### Anthropic (Direct)

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-5-20250514",
  "baseURL": null
}
```

**Available Models:**
| Model ID | Name | Best For |
|----------|------|----------|
| `claude-sonnet-4-5-20250514` | Claude 4.5 Sonnet | General use (recommended) |
| `claude-opus-4-5-20250514` | Claude 4.5 Opus | Complex tasks |
| `claude-sonnet-4-20250514` | Claude 4 Sonnet | Fast responses |
| `claude-3-5-haiku-20241022` | Claude 3.5 Haiku | Speed |

### OpenAI

```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "baseURL": null
}
```

**Available Models:**
| Model ID | Name | Best For |
|----------|------|----------|
| `gpt-4o` | GPT-4o | General use (recommended) |
| `gpt-4o-mini` | GPT-4o Mini | Fast, cheap |
| `gpt-4-turbo` | GPT-4 Turbo | Complex tasks |
| `gpt-3.5-turbo` | GPT-3.5 Turbo | Cheapest |

### Z.ai GLM (Direct)

```json
{
  "provider": "glm",
  "apiKey": "...",
  "model": "glm-4-plus",
  "baseURL": "https://open.bigmodel.cn/api/paas/v4"
}
```

**Available Models:**
| Model ID | Name | Best For |
|----------|------|----------|
| `glm-4-plus` | GLM-4 Plus | Most capable |
| `glm-4-0520` | GLM-4-0520 | Recommended |
| `glm-4-flash` | GLM-4 Flash | Cheapest |
| `glm-4-long` | GLM-4 Long | 128K context |

### Anthropic-Compatible (Custom Endpoint)

Use any Anthropic-compatible API:

```json
{
  "provider": "anthropic-compatible",
  "apiKey": "...",
  "model": "glm-4.7",
  "baseURL": "https://api.z.ai/api/anthropic"
}
```

This mode works with:
- **Z.ai**: `https://api.z.ai/api/anthropic`
- **Custom endpoints**: Any server implementing the Anthropic API

## System Prompts

Customize the AI's behavior with system prompts.

### Default Prompt

```
You are Floyd, a helpful AI assistant with access to tools for file system operations and command execution. Use tools when needed to help the user.
```

### Custom Prompt Example

```
You are Floyd, a senior software engineer assistant. You:
- Write clean, well-documented code
- Follow best practices and design patterns
- Explain your reasoning
- Suggest improvements when you see them
- Use tools to verify your work
```

### Via API

```bash
curl -X POST http://localhost:3001/api/settings \
  -H 'Content-Type: application/json' \
  -d '{"systemPrompt": "You are a code review expert..."}'
```

## Data Storage

### Location

All user data is stored in `.floyd-data/`:

```
.floyd-data/
├── settings.json       # User settings
├── sessions/           # Chat sessions
│   ├── uuid-1.json
│   ├── uuid-2.json
│   └── ...
├── skills/             # Custom skills
│   └── skills.json
└── projects/           # Project configurations
    └── projects.json
```

### Sessions

Each session is a JSON file:

```json
{
  "id": "uuid",
  "title": "New Chat",
  "created": 1771149793635,
  "updated": 1771149793635,
  "messages": [
    {"role": "user", "content": "...", "timestamp": ...},
    {"role": "assistant", "content": "...", "timestamp": ...}
  ],
  "customTitle": "My Chat",
  "pinned": false,
  "archived": false,
  "folder": "Work"
}
```

### Backup

To backup your data:

```bash
# Create backup
cp -r .floyd-data .floyd-data-backup-$(date +%Y%m%d)

# Or archive
tar -czvf floyd-backup.tar.gz .floyd-data/
```

## Tool Security

### Allowed Paths

The tool executor restricts file operations to allowed directories:

```typescript
// Default allowed paths
[
  process.cwd(),     // Current working directory
  process.env.HOME,  // User home directory
  '/tmp'             // Temp directory
]
```

### Blocked Commands

Dangerous commands are blocked:

- `rm -rf /`
- `mkfs`
- `dd if=`
- Fork bombs

### Customizing Restrictions

Modify `server/tool-executor.ts`:

```typescript
const toolExecutor = new ToolExecutor([
  '/safe/directory/1',
  '/safe/directory/2',
]);
```

## Server Ports

### HTTP Server (Port 3001)

Main web server and REST API.

```bash
# Change port
PORT=8080 npm run dev
```

### WebSocket MCP Server (Port 3005)

For Chrome extension communication.

If port 3005 is in use, the server logs a warning and continues without WebSocket support.

## CLI Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLOYD_SERVER_URL` | `http://localhost:3001` | Server URL for CLI |

### Usage

```bash
# Default
./floyd-cli

# Custom server
./floyd-cli http://192.168.1.100:3001

# Via environment
FLOYD_SERVER_URL=http://remote:3001 ./floyd-cli
```

## Logging

Server logs are written to stdout:

```
[Floyd Web Server] Running on http://localhost:3001
[Floyd Web Server] API Key: Configured
[Floyd Web Server] WebSocket MCP server started on port 3005
[Server] Loaded 16 sessions from disk
[Server] Loaded 13 skills
```

### Log Levels

- Standard logs: Server events, connections
- Error logs: Failed operations, exceptions

## Production Configuration

### Building

```bash
npm run build
```

Creates:
- `dist/` - Frontend static files
- `dist-server/` - Compiled server

### Running

```bash
npm start
# Or with custom port
PORT=8080 npm start
```

### Process Management

Using PM2:

```bash
# Install PM2
npm install -g pm2

# Start
pm2 start dist-server/index.js --name floyd

# Monitor
pm2 logs floyd

# Restart
pm2 restart floyd
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name floyd.example.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Related

- [Getting Started](../guides/getting-started.md)
- [Tools Reference](tools.md)
- [REST API](../api/rest-api.md)
