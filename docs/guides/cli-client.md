# CLI Client Guide

Floyd Desktop includes a terminal-based client for chat and browser automation from the command line.

## Starting the CLI

### Prerequisites

- The Floyd server must be running (`npm run dev` or `npm start`)
- Node.js 18+

### Basic Usage

```bash
# Connect to default server (http://localhost:3001)
./floyd-cli

# Connect to a specific server
./floyd-cli http://192.168.1.100:3001

# Use environment variable
FLOYD_SERVER_URL=http://remote-server:3001 ./floyd-cli
```

## Commands

| Command | Description |
|---------|-------------|
| `help` | Show available commands |
| `exit` or `quit` | Exit the CLI |
| `screenshot <url>` | Capture a website screenshot |
| `clear` | Clear the terminal screen |

## Chatting

Just type your message and press Enter:

```
>>> What is the capital of France?
The capital of France is Paris. It's known for the Eiffel Tower...
```

The AI can use tools automatically:

```
>>> Read package.json and tell me the version
[Using: read_file]
The version in package.json is 0.1.0.
```

## Screenshots

The `screenshot` command captures a web page:

```
>>> screenshot https://example.com
[Screenshot received - PNG]

[Image displayed inline in iTerm2/Kitty]
```

## Terminal Image Support

The CLI automatically detects your terminal and displays images appropriately:

| Terminal | Behavior |
|----------|----------|
| **iTerm2** | Inline image display |
| **Kitty** | Inline image display |
| **X11/Wayland** | Saves to temp file, shows path |
| **Other** | Saves to temp file, shows path |

### Saved Image Location

Images are saved to:
```
~/.floyd-screenshot-<timestamp>.png
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLOYD_SERVER_URL` | `http://localhost:3001` | Server URL to connect to |

## Streaming Output

Responses stream in real-time. You'll see:
- Text appearing character by character
- Tool usage indicators: `[Using: tool_name]`
- Image notifications: `[Screenshot received - PNG]`

## Examples

### Quick Question

```bash
./floyd-cli
>>> What's 2+2?
4
>>> exit
```

### File Analysis

```bash
>>> Read the README.md file and summarize it
[Using: read_file]
The README describes Floyd Desktop, an AI assistant web app...
```

### Web Screenshot

```bash
>>> screenshot https://github.com
[Screenshot received - PNG]
[Image displayed]
```

### Remote Server

```bash
# Connect to a server running elsewhere
./floyd-cli https://floyd.example.com

# Or with environment variable
export FLOYD_SERVER_URL=https://floyd.example.com
./floyd-cli
```

## Troubleshooting

### "Server not reachable"

1. Verify the server is running: `curl http://localhost:3001/api/health`
2. Check the URL is correct
3. Ensure no firewall is blocking the connection

### "Failed to create session"

- The server may be overloaded
- Try restarting the server

### Images Not Displaying

- **iTerm2**: Ensure you're on version 3.0+
- **Kitty**: Ensure graphics protocol is enabled
- **Other terminals**: Check the temp file path shown

### Connection Drops

The CLI doesn't auto-reconnect. If the connection drops:
1. Exit with `Ctrl+D` or `exit`
2. Restart the CLI

## Programmatic Usage

The CLI client (`cli-client.js`) can be imported as a module:

```javascript
import { FloydClient } from './cli-client.js';

const client = new FloydClient('http://localhost:3001');

// Check health
const health = await client.checkHealth();

// Create session
const session = await client.createSession();

// Send message with callbacks
await client.sendMessage('Hello!', {
  onText: (text) => process.stdout.write(text),
  onToolCall: (tool, args) => console.log(`Using: ${tool}`),
  onDone: () => console.log('\nDone'),
  onError: (err) => console.error('Error:', err),
});
```

## Related

- [Getting Started](getting-started.md)
- [Browser Automation](browser-automation.md)
- [REST API](../api/rest-api.md)
