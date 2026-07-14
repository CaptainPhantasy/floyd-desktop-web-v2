# Floyd Desktop

Natural-language coding desktop backed by Floyd Core.

## Overview

Floyd Desktop is a presentation surface. It does not own provider credentials or call providers directly. The coding pane talks to its server-side `@floyd/sdk` bridge, Floyd Core owns durable runs and policy, and Core delegates execution to its managed OpenCode SDK runtime.

## Features

- **Central Model Routing**: Floyd Core owns provider and model selection
- **MCP Tool Integration**: Execute tools via Model Context Protocol servers
- **Streaming Responses**: Real-time streaming of AI responses
- **Session Management**: Persistent chat sessions with history
- **Skills System**: Extensible skill framework for custom behaviors
- **Projects Manager**: Organize work by project
- **Chrome Extension Integration**: WebSocket-based MCP server for browser automation

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (runs both client and server)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Development

- **Client**: Vite + React + TypeScript
- **Server**: Express + TypeScript
- **Styling**: Tailwind CSS with custom CRUSH theme
- **Testing**: Vitest + Playwright

## Environment

The default configuration connects to the loopback Core and reads its private gateway token from the canonical runtime directory. Override only when the runtime is installed elsewhere:

```env
FLOYD_CORE_URL=http://127.0.0.1:41414
FLOYD_GATEWAY_TOKEN_FILE=/Volumes/Storage/FLOYD_RUNTIME/core/gateway.token
# Required when Core has more than one registered project and Desktop has no
# active project with an exact rootPath match.
FLOYD_PROJECT_ID=project_id_from_floyd_core
# Defaults to loopback. Set another address only on an explicitly trusted host.
HOST=127.0.0.1
# Optional Chrome extension bridge port. A bind failure does not stop Desktop.
MCP_WS_PORT=3005
```

Never place a provider key or the Floyd gateway token in browser storage, a URL, or a command-line argument.

## Migration boundary

The rendered coding pane uses only `/api/core/health` and `/api/core/chat/stream`. Legacy direct-provider server routes remain temporarily for compatibility with older callers, but the current UI cannot invoke them. Removing those routes and their Anthropic/OpenAI dependencies is a separate breaking migration.

## Project Structure

```
├── src/              # React client source
├── server/           # Express backend
├── docs/             # Documentation
├── public/           # Static assets
└── dist/             # Build output
```

## License

MIT License - see [LICENSE](LICENSE) file

## Governing Document

This repository currently has no checked-in `FLOYD.md`; the upstream README link was stale.
