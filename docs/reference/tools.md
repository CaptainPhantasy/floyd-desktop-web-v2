# Tools Reference

Floyd Desktop has 41 built-in tools for file operations, command execution, browser automation, and more.

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| [File System](#file-system-tools) | 9 | Read, write, search files |
| [Process/Command](#processcommand-tools) | 7 | Execute commands, manage processes |
| [Code Execution](#code-execution-tools) | 1 | Run Python, Node.js, Bash |
| [Browser](#browser-tools) | 6 | Web automation and screenshots |
| [Superpowers](#superpowers-tools) | 9 | Advanced code analysis |
| [Cache](#cache-tools) | 3 | Store and retrieve data |
| [Novel](#novel-tools) | 6 | Experimental features |

---

## File System Tools

### read_file

Read contents of a file with optional pagination.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to read |
| `offset` | number | No | Line offset (negative reads from end) |
| `limit` | number | No | Maximum lines (default 1000) |

**Example:**
```json
{"name": "read_file", "args": {"path": "package.json", "limit": 50}}
```

### write_file

Write content to a file. Creates parent directories if needed.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to write |
| `content` | string | Yes | Content to write |
| `append` | boolean | No | Append instead of overwrite |

**Example:**
```json
{"name": "write_file", "args": {"path": "output.txt", "content": "Hello World"}}
```

### list_directory

Get detailed listing of files and directories.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Directory path |

**Returns:** Array of files with name, type, size, modified date.

### search_files

Search for files by pattern and/or content.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Base directory |
| `pattern` | string | No | Glob pattern (e.g., `**/*.ts`) |
| `contentRegex` | string | No | Regex to match in file contents |

### create_directory

Create a directory and any parent directories.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Directory path to create |

### delete_file

Delete a file or directory.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Path to delete |

### move_file

Move or rename a file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | string | Yes | Source path |
| `destination` | string | Yes | Destination path |

### get_file_info

Get detailed file metadata.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path |

**Returns:** Size, created date, modified date, permissions.

### edit_block

Perform a precise block edit in a file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path |
| `oldContent` | string | Yes | Content to replace |
| `newContent` | string | Yes | Replacement content |

---

## Process/Command Tools

### execute_command

Execute a shell command.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | string | Yes | Command to execute |
| `cwd` | string | No | Working directory |
| `timeout` | number | No | Timeout in ms (default 30000) |

**Example:**
```json
{"name": "execute_command", "args": {"command": "npm test"}}
```

### start_process

Start a long-running process.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | string | Yes | Command to start |
| `cwd` | string | No | Working directory |

**Returns:** Process ID for later interaction.

### interact_with_process

Send input to a running process.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pid` | number | Yes | Process ID |
| `input` | string | Yes | Input to send |

### read_process_output

Read output from a running process.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pid` | number | Yes | Process ID |

### force_terminate

Forcefully terminate a process.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pid` | number | Yes | Process ID |

### list_sessions

List active process sessions.

### list_processes

List all system processes.

### kill_process

Kill a system process by PID.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pid` | number | Yes | Process ID |

---

## Code Execution Tools

### execute_code

Execute code in a sandboxed environment.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `language` | string | Yes | One of: `python`, `node`, `bash` |
| `code` | string | Yes | Code to execute |
| `timeout` | number | No | Timeout in ms (default 30000) |

**Example:**
```json
{
  "name": "execute_code",
  "args": {
    "language": "python",
    "code": "print(sum(range(10)))"
  }
}
```

**Returns:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "output": "45\n"
  }
}
```

---

## Browser Tools

### browser_screenshot

Take a screenshot of a web page using Puppeteer.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes* | URL to capture |
| `selector` | string | No | CSS selector for specific element |

*Required for Puppeteer mode. Optional for Chrome extension mode.

**Returns:** Base64-encoded PNG image.

**Example:**
```json
{
  "name": "browser_screenshot",
  "args": {"url": "https://example.com"}
}
```

### browser_navigate

Navigate the browser to a URL.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes | URL to navigate to |

**Requires:** Chrome extension

### browser_read_page

Get the accessibility tree and semantic structure of the current page.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | No | CSS selector to limit scope |

**Requires:** Chrome extension

### browser_click

Click an element on the page.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes* | CSS selector |
| `x` | number | No | X coordinate |
| `y` | number | No | Y coordinate |

*Either selector or coordinates required.

**Requires:** Chrome extension

### browser_type

Type text into an element.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | string | Yes | Text to type |
| `selector` | string | No | CSS selector (uses focus if omitted) |

**Requires:** Chrome extension

### browser_get_tabs

List all open tabs in the browser.

**Requires:** Chrome extension

---

## Superpowers Tools

Advanced code analysis and manipulation tools.

### project_map

Generate a structural map of the project.

### smart_replace

Intelligent find-and-replace with context awareness.

### list_symbols

List code symbols (functions, classes, etc.) in a file.

### semantic_search

Search code using semantic understanding.

### check_diagnostics

Check for linting errors, type errors, etc.

### fetch_docs

Fetch documentation for a library or API.

### dependency_xray

Analyze project dependencies.

### visual_verify

Visual verification of UI changes.

### todo_sniper

Find and list TODO comments in the codebase.

---

## Cache Tools

### cache_store

Store data in the cache.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | Yes | Cache key |
| `value` | any | Yes | Value to store |

### cache_retrieve

Retrieve data from the cache.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | string | Yes | Cache key |

### cache_search

Search the cache for matching keys.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pattern` | string | Yes | Search pattern |

---

## Novel Tools

Experimental and advanced features.

### runtime_schema_gen

Generate schemas from runtime data.

### tui_puppeteer

Terminal UI automation with Puppeteer.

### ast_navigator

Navigate and analyze Abstract Syntax Trees.

### skill_crystallizer

Extract and crystallize patterns as reusable skills.

### manage_scratchpad

Manage a temporary scratchpad for notes and data.

---

## Direct Tool Execution

You can execute tools directly via the API:

```bash
curl -X POST http://localhost:3001/api/tools/execute \
  -H 'Content-Type: application/json' \
  -d '{"name": "read_file", "args": {"path": "README.md"}}'
```

## Tool Execution in Chat

When chatting, the AI automatically uses tools when needed:

```
You: Read package.json and tell me the dependencies

AI: I'll read that file for you.
[Tool: read_file]
Based on package.json, here are the dependencies...
```

## Security

Tools execute with the permissions of the server process. Some safeguards:

- Path restrictions limit file access to allowed directories
- Dangerous commands are blocked (e.g., `rm -rf /`)
- Process timeouts prevent runaway execution

## Related

- [REST API Reference](../api/rest-api.md) - Tool execution endpoint
- [Configuration](configuration.md) - Path restrictions and security settings
