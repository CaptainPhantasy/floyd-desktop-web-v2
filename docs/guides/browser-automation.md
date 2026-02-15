# Browser Automation Guide

Floyd Desktop can interact with web pages through browser automation tools.

## Two Modes of Operation

| Mode | Tools | Requirements |
|------|-------|--------------|
| **Puppeteer (Built-in)** | `browser_screenshot` | None - works out of the box |
| **Chrome Extension** | All browser tools | Chrome extension required |

## Puppeteer Screenshots (Built-in)

The `browser_screenshot` tool uses Puppeteer and works without any setup.

### Usage in Chat

```
You: Take a screenshot of https://example.com

AI: [Uses browser_screenshot tool]
Here's the screenshot of example.com:
[Image displayed]
```

### Usage via API

```bash
curl -X POST http://localhost:3001/api/tools/execute \
  -H 'Content-Type: application/json' \
  -d '{"name": "browser_screenshot", "args": {"url": "https://example.com"}}'
```

### Response Format

```json
{
  "success": true,
  "result": {
    "image": "iVBORw0KGgo...",
    "format": "png",
    "encoding": "base64",
    "mimeType": "image/png"
  }
}
```

## Chrome Extension Mode

For full browser control, install the Floyd Chrome Extension.

### Available Tools

| Tool | Description |
|------|-------------|
| `browser_navigate` | Go to a URL |
| `browser_screenshot` | Capture current page |
| `browser_read_page` | Get page content/accessibility tree |
| `browser_click` | Click an element |
| `browser_type` | Type text into an element |
| `browser_get_tabs` | List open tabs |

### Setup

1. **Build or Download the Extension**
   - The extension should be in a companion repository
   - Load it in Chrome via `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"

2. **Verify Connection**
   - The extension connects to `ws://localhost:3005`
   - Check browser console for "Connected to Floyd" message

3. **Test It**
   ```
   You: Navigate to https://example.com and take a screenshot

   AI: [Uses browser_navigate]
       [Uses browser_screenshot]
   ```

### Example Interactions

#### Navigate and Read

```
You: Go to https://news.ycombinator.com and tell me the top story

AI: [Uses browser_navigate]
    [Uses browser_read_page]
The top story on Hacker News is...
```

#### Click and Type

```
You: Search for "floyd desktop" on Google

AI: [Uses browser_navigate to google.com]
    [Uses browser_type into search box]
    [Uses browser_click on search button]
Here are the search results...
```

#### Get All Tabs

```
You: What tabs do I have open?

AI: [Uses browser_get_tabs]
You have 3 tabs open:
1. GitHub - Floyd Desktop
2. Gmail
3. YouTube
```

## Tool Reference

### browser_screenshot

Captures a screenshot of a web page.

**Arguments:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes* | URL to navigate to first |
| `selector` | string | No | CSS selector for specific element |

*If using Chrome extension mode, URL is optional (screenshots current page)

### browser_navigate

Navigates to a URL.

**Arguments:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to navigate to |

### browser_read_page

Gets the page content as an accessibility tree.

**Arguments:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | No | CSS selector to limit scope |

### browser_click

Clicks an element on the page.

**Arguments:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | Yes | CSS selector for element |
| `x` | number | No | X coordinate (alternative) |
| `y` | number | No | Y coordinate (alternative) |

### browser_type

Types text into the focused element or a specific selector.

**Arguments:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to type |
| `selector` | string | No | CSS selector (uses focus if omitted) |

### browser_get_tabs

Lists all open browser tabs.

**Arguments:** None

## WebSocket Protocol

The Chrome extension connects via WebSocket to port 3005.

**Connection URL:** `ws://localhost:3005`

**Protocol:** JSON-RPC 2.0

### Example Messages

**Initialize:**
```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {...}}
```

**List Tools:**
```json
{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
```

**Call Tool:**
```json
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "browser_navigate", "arguments": {"url": "https://example.com"}}}
```

## Troubleshooting

### "Chrome extension not connected"

1. Verify the server is running on port 3005:
   ```bash
   lsof -i :3005
   ```

2. Check the extension is loaded and enabled

3. Look for errors in the Chrome extension console

### "browser_navigate not working"

- Requires Chrome extension
- Puppeteer-only mode only supports `browser_screenshot`

### Screenshots are blank

- The page may not have finished loading
- Try adding a delay or using `waitUntil: 'networkidle'`

### "WebSocket error"

- Check firewall settings
- Verify port 3005 is not blocked
- Ensure server started successfully (check logs)

## Security Notes

- Browser automation can access any URL the browser can reach
- Be cautious with authentication sessions
- The extension has access to all tabs
- Consider using a separate browser profile

## Related

- [CLI Client](cli-client.md) - Screenshot command
- [Tools Reference](../reference/tools.md) - All tools
- [REST API](../api/rest-api.md) - Tool execution endpoint
