# Getting Started with Floyd Desktop

This guide will help you install, configure, and use Floyd Desktop for the first time.

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- An API key from one of these providers:
  - [Anthropic](https://console.anthropic.com/) (Claude)
  - [OpenAI](https://platform.openai.com/) (GPT)
  - [Z.ai](https://z.ai/) (GLM)

## Installation

### 1. Clone or Download

```bash
git clone <repository-url>
cd FloydDesktopWeb-v2
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env.local` file in the project root:

```env
# Choose one or more API keys
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here
GLM_API_KEY=your-glm-key-here

# Optional: Change default port
PORT=3001
```

### 4. Start the Server

```bash
# Development mode (hot reload)
npm run dev

# Or production mode
npm run build
npm start
```

### 5. Open the Web Interface

Navigate to [http://localhost:3001](http://localhost:3001)

## First-Time Setup

### 1. Configure Your Provider

1. Click the **Settings** icon (gear) in the sidebar
2. Select your **Provider** from the dropdown:
   - **Anthropic** - Direct Claude API
   - **OpenAI** - GPT models
   - **Zai GLM (Zhipu)** - GLM models
   - **Anthropic-Compatible** - Custom endpoints
3. Enter your **API Key**
4. Select a **Model**
5. Click **Test Key** to verify
6. Click **Save**

### 2. Start a Chat

1. Click **New Chat** in the sidebar
2. Type your message in the input box
3. Press Enter or click Send
4. Watch the AI respond in real-time

## Basic Usage

### Chatting

Just type your message and press Enter. The AI will respond with streaming text.

### Using Tools

The AI can use tools automatically when needed:

```
You: Read the file package.json and tell me the project name

AI: I'll read that file for you.
[Uses read_file tool]
The project name is "floyd-desktop".
```

### Managing Sessions

- **Rename**: Click the session title to edit
- **Pin**: Click the pin icon to keep important chats at the top
- **Folder**: Use folders to organize related sessions
- **Archive**: Hide old sessions without deleting them

### Regenerating Responses

If you want a different response:

1. Hover over the last AI message
2. Click the **Regenerate** button
3. The AI will create a new response

### Editing Messages

1. Hover over any **user** message
2. Click the **Edit** button
3. Change the text
4. Submit to regenerate the conversation from that point

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Escape` | Cancel/close modals |

## Next Steps

- [CLI Client Guide](cli-client.md) - Use from terminal
- [Browser Automation](browser-automation.md) - Control web pages
- [Tools Reference](../reference/tools.md) - All available tools
- [Skills System](skills.md) - Customize AI behavior

## Troubleshooting

### "API key not configured"

Make sure you:
1. Created `.env.local` with your key, OR
2. Entered the key in Settings

### "Port 3001 already in use"

```bash
# Find what's using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3002 npm run dev
```

### "Streaming not working"

- Check your network connection
- Verify your API key is valid
- Check browser console for errors

## Getting Help

- Check the [FAQ](../troubleshooting/faq.md)
- Review [Common Errors](../troubleshooting/common-errors.md)
- Check the [API Reference](../api/rest-api.md) for integration issues
