# Floyd Desktop Documentation

Welcome to the Floyd Desktop documentation. Use the guides below to get started and learn about all features.

## Getting Started

| Guide | Description |
|-------|-------------|
| [Getting Started](guides/getting-started.md) | Installation, configuration, and your first chat |
| [CLI Client](guides/cli-client.md) | Use Floyd from the terminal |
| [Browser Automation](guides/browser-automation.md) | Web scraping and browser control |
| [Skills System](guides/skills.md) | Create and use custom AI skills |
| [Projects](guides/projects.md) | Organize work by project |

## Reference

| Document | Description |
|----------|-------------|
| [Tools Reference](reference/tools.md) | Complete catalog of 41 tools |
| [Configuration](reference/configuration.md) | Environment variables and settings |
| [Providers](reference/providers.md) | AI provider setup and models |

## API Documentation

| Document | Description |
|----------|-------------|
| [REST API Reference](api/rest-api.md) | All endpoints with examples |

## Troubleshooting

| Document | Description |
|----------|-------------|
| [Common Errors](troubleshooting/common-errors.md) | Solutions to frequent issues |
| [FAQ](troubleshooting/faq.md) | Frequently asked questions |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FLOYD DESKTOP ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│   │   Web UI    │     │  CLI Client │     │   REST API  │                   │
│   │  (React)    │     │  (Node.js)  │     │  (Express)  │                   │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                   │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              ▼                                              │
│                    ┌─────────────────┐                                      │
│                    │  Express Server │                                      │
│                    │   (Port 3001)   │                                      │
│                    └────────┬────────┘                                      │
│                             │                                               │
│         ┌───────────────────┼───────────────────┐                          │
│         ▼                   ▼                   ▼                          │
│   ┌───────────┐      ┌───────────┐      ┌───────────┐                      │
│   │   Skills  │      │ Projects  │      │  Sessions │                      │
│   │  Manager  │      │  Manager  │      │  Storage  │                      │
│   └───────────┘      └───────────┘      └───────────┘                      │
│                             │                                               │
│         ┌───────────────────┼───────────────────┐                          │
│         ▼                   ▼                   ▼                          │
│   ┌───────────┐      ┌───────────┐      ┌───────────┐                      │
│   │   Tool    │      │WebSocket  │      │    AI     │                      │
│   │ Executor  │      │MCP Server │      │Providers  │                      │
│   │ (41 tools)│      │(Port 3005)│      │(4 providers)│                    │
│   └───────────┘      └───────────┘      └───────────┘                      │
│                             │                                               │
│                             ▼                                               │
│                    ┌─────────────────┐                                      │
│                    │Chrome Extension │                                      │
│                    │(Browser Control)│                                      │
│                    └─────────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Links

- **Main README**: [../README.md](../README.md)
- **Governing Document**: [../FLOYD.MD](../FLOYD.MD)
- **Agent Instructions**: [../Claude.md](../Claude.md)

## Contributing to Docs

Documentation should be:
- **Accurate**: Based on actual code behavior
- **Complete**: Cover all user-facing features
- **Clear**: Written for end users, not developers
- **Current**: Updated when features change

When adding new features, update the relevant documentation.
