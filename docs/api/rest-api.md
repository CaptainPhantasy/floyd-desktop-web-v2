# REST API Reference

Complete reference for the Floyd Desktop REST API.

**Base URL:** `http://localhost:3001`

## Authentication

API keys are configured via:
1. `.env.local` file (server-side)
2. Settings API (stored in `.floyd-data/settings.json`)

The API itself doesn't require authentication - it's designed for local use.

---

## Health & Status

### GET /api/health

Check server status.

**Response:**
```json
{
  "status": "ok",
  "hasApiKey": true,
  "provider": "anthropic-compatible",
  "model": "glm-4.7"
}
```

---

## Providers

### GET /api/providers

Get available providers and their models.

**Response:**
```json
{
  "providers": [
    {"id": "anthropic", "name": "Anthropic"},
    {"id": "openai", "name": "OpenAI"},
    {"id": "glm", "name": "Zai GLM (Zhipu)"},
    {"id": "anthropic-compatible", "name": "Anthropic-Compatible (Custom Endpoint)"}
  ],
  "models": {
    "anthropic": [
      {"id": "claude-sonnet-4-5-20250514", "name": "Claude 4.5 Sonnet (Recommended)"},
      {"id": "claude-opus-4-5-20250514", "name": "Claude 4.5 Opus (Most Capable)"}
    ],
    "openai": [...],
    "glm": [...],
    "anthropic-compatible": [...]
  }
}
```

---

## Settings

### GET /api/settings

Get current settings.

**Response:**
```json
{
  "provider": "anthropic-compatible",
  "model": "glm-4.7",
  "hasApiKey": true,
  "apiKeyPreview": "sk-ant-api...bQAA",
  "systemPrompt": "You are Floyd...",
  "maxTokens": 16384,
  "baseURL": "https://api.z.ai/api/anthropic"
}
```

### POST /api/settings

Update settings.

**Request Body:**
```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-5-20250514",
  "systemPrompt": "Custom prompt",
  "maxTokens": 8192,
  "baseURL": "https://custom.api.com/v1"
}
```

**Response:**
```json
{"success": true}
```

### POST /api/test-key

Test if an API key is valid.

**Request Body:**
```json
{
  "apiKey": "sk-ant-...",
  "provider": "anthropic"
}
```

**Success Response:**
```json
{
  "success": true,
  "model": "claude-sonnet-4-5-20250514",
  "message": "Anthropic API key is valid"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

---

## Sessions

### GET /api/sessions

List all sessions.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `folder` | string | Filter by folder name |
| `archived` | boolean | Filter by archived status |

**Response:**
```json
[
  {
    "id": "uuid-here",
    "title": "New Chat",
    "created": 1771149793635,
    "updated": 1771149793635,
    "messageCount": 5,
    "customTitle": "My Conversation",
    "pinned": true,
    "archived": false,
    "folder": "Work"
  }
]
```

### POST /api/sessions

Create a new session.

**Response:**
```json
{
  "id": "new-uuid",
  "title": "New Chat",
  "created": 1771149793635,
  "updated": 1771149793635,
  "messages": []
}
```

### GET /api/sessions/:id

Get a specific session with full message history.

**Response:**
```json
{
  "id": "uuid",
  "title": "New Chat",
  "created": 1771149793635,
  "updated": 1771149793635,
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": 1771149794000
    },
    {
      "role": "assistant",
      "content": "Hi there!",
      "timestamp": 1771149795000
    }
  ],
  "customTitle": null,
  "pinned": false,
  "archived": false,
  "folder": null
}
```

### PUT /api/sessions/:id

Update a session.

**Request Body:**
```json
{
  "title": "Updated Title",
  "messages": [...]
}
```

### DELETE /api/sessions/:id

Delete a session.

**Response:**
```json
{"success": true}
```

### PATCH /api/sessions/:id/rename

Rename a session.

**Request Body:**
```json
{"customTitle": "My New Name"}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "title": "New Chat",
    "customTitle": "My New Name",
    "displayTitle": "My New Name",
    "updated": 1771149900000
  }
}
```

### PATCH /api/sessions/:id/pin

Pin or unpin a session.

**Request Body:**
```json
{"pinned": true}
```

### PATCH /api/sessions/:id/folder

Assign session to a folder.

**Request Body:**
```json
{"folder": "Work Projects"}
```

### PATCH /api/sessions/:id/archive

Archive or unarchive a session.

**Request Body:**
```json
{"archived": true}
```

### POST /api/sessions/:id/regenerate

Regenerate the last assistant response (SSE streaming).

**Response:** Server-Sent Events stream

### POST /api/sessions/:id/continue

Continue a truncated response (SSE streaming).

**Response:** Server-Sent Events stream

### PATCH /api/sessions/:id/messages/:messageIndex

Edit a user message and cascade (remove subsequent messages).

**Request Body:**
```json
{"content": "Updated message text"}
```

---

## Folders

### GET /api/folders

List all folders that have sessions.

**Response:**
```json
{
  "folders": ["Work", "Personal", "Research"]
}
```

---

## Chat

### POST /api/chat

Send a message (non-streaming).

**Request Body:**
```json
{
  "sessionId": "uuid-or-null",
  "message": "Hello, how are you?"
}
```

**Response:**
```json
{
  "success": true,
  "response": "I'm doing well, thank you for asking!",
  "usage": {
    "input_tokens": 15,
    "output_tokens": 12
  },
  "session": {
    "id": "uuid",
    "title": "Hello, how are you?"
  }
}
```

### POST /api/chat/stream

Send a message with streaming response (SSE).

**Request Body:**
```json
{
  "sessionId": "uuid-or-null",
  "message": "Hello",
  "enableTools": true
}
```

**Response:** Server-Sent Events stream

**Event Types:**

| Type | Description | Data |
|------|-------------|------|
| `text` | Text chunk | `{"type": "text", "content": "..."}` |
| `tool_call` | Tool being called | `{"type": "tool_call", "tool": "name", "args": {...}}` |
| `tool_result` | Tool execution result | `{"type": "tool_result", "tool": "name", "result": {...}, "success": true}` |
| `image` | Image data | `{"type": "image", "data": "base64...", "format": "png"}` |
| `done` | Stream complete | `{"type": "done", "sessionId": "..."}` |
| `error` | Error occurred | `{"type": "error", "error": "message"}` |

---

## Tools

### GET /api/tools

List all available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {"type": "string", "description": "File path"},
          "limit": {"type": "number", "description": "Max lines"}
        },
        "required": ["path"]
      }
    }
  ]
}
```

### POST /api/tools/execute

Execute a tool directly.

**Request Body:**
```json
{
  "name": "read_file",
  "args": {
    "path": "package.json",
    "limit": 10
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "result": "{\n  \"name\": \"floyd-desktop\",\n  ..."
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "File not found"
}
```

---

## Skills

### GET /api/skills

List all skills.

**Response:**
```json
{
  "skills": [
    {
      "id": "code-review",
      "name": "Code Review",
      "description": "Thorough code review...",
      "instructions": "When reviewing code...",
      "triggers": ["review", "code review"],
      "enabled": true,
      "category": "coding",
      "icon": "🔍",
      "isActive": false
    }
  ]
}
```

### GET /api/skills/active

List only active skills.

### POST /api/skills

Create a new skill.

**Request Body:**
```json
{
  "name": "My Custom Skill",
  "description": "Does something useful",
  "instructions": "When triggered, do X, Y, Z",
  "triggers": ["trigger1", "trigger2"],
  "category": "custom",
  "icon": "🚀"
}
```

### PUT /api/skills/:id

Update a skill.

### DELETE /api/skills/:id

Delete a skill.

### POST /api/skills/:id/activate

Activate a skill.

### POST /api/skills/:id/deactivate

Deactivate a skill.

---

## Projects

### GET /api/projects

List all projects.

**Response:**
```json
{
  "projects": [
    {
      "id": "project-uuid",
      "name": "My Project",
      "description": "Project description",
      "path": "/path/to/project",
      "files": [...],
      "created": 1771149793635,
      "updated": 1771149793635
    }
  ],
  "activeId": "project-uuid"
}
```

### GET /api/projects/active

Get the currently active project.

### POST /api/projects

Create a new project.

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Description",
  "path": "/path/to/project"
}
```

### PUT /api/projects/:id

Update a project.

### DELETE /api/projects/:id

Delete a project.

### POST /api/projects/:id/activate

Set as active project.

### POST /api/projects/deactivate

Deactivate current project.

### POST /api/projects/:id/files

Add a file or snippet to a project.

**Request Body (file):**
```json
{
  "path": "/full/path/to/file.ts",
  "type": "file"
}
```

**Request Body (snippet):**
```json
{
  "type": "snippet",
  "name": "Example Code",
  "content": "const x = 1;"
}
```

### DELETE /api/projects/:id/files

Remove a file from a project.

---

## Browork (Background Tasks)

### GET /api/browork/tasks

List all background tasks.

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-uuid",
      "name": "Analyze Codebase",
      "description": "Analyze the entire codebase",
      "status": "running",
      "created": 1771149793635,
      "result": null
    }
  ]
}
```

### GET /api/browork/tasks/:id

Get a specific task.

### POST /api/browork/tasks

Create a new background task.

**Request Body:**
```json
{
  "name": "Task Name",
  "description": "Detailed description of what to do"
}
```

### POST /api/browork/tasks/:id/start

Start executing a task.

### POST /api/browork/tasks/:id/cancel

Cancel a running task.

### DELETE /api/browork/tasks/:id

Delete a task.

### POST /api/browork/clear

Clear all finished tasks.

---

## Error Responses

All endpoints may return errors in this format:

```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad request (missing/invalid parameters)
- `401` - Authentication error (invalid API key)
- `404` - Not found
- `500` - Server error
