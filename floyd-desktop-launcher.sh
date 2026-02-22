#!/bin/bash
# Floyd Desktop Web Launcher
# Starts the backend servers and opens the web app in the browser

# Set up PATH for GUI apps
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

SCRIPT_DIR="/Volumes/Storage/FloydDesktopWeb-v2"
SERVER_URL="http://localhost:5173"
LOCKFILE="/tmp/floyd-desktop-launcher.lock"

# Prevent multiple instances
if [ -f "$LOCKFILE" ]; then
    # Check if the process is still running
    OLD_PID=$(cat "$LOCKFILE" 2>/dev/null || echo "")
    if [ -n "$OLD_PID" ] && ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Floyd Desktop is already starting/running (PID: $OLD_PID)"
        echo "Just opening the browser..."
        open "$SERVER_URL"
        exit 0
    else
        rm -f "$LOCKFILE"
    fi
fi

# Save our PID
echo $$ > "$LOCKFILE"

echo "Starting Floyd Desktop Web..."

# Check if frontend is already running
if curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL" 2>/dev/null | grep -q "200\|302"; then
    echo "✓ Frontend server already running on $SERVER_URL"
    open "$SERVER_URL"
    rm -f "$LOCKFILE"
    exit 0
fi

# Kill any existing process on port 5173
EXISTING_PID=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
    echo "Killing existing process on port 5173 (PID: $EXISTING_PID)"
    kill "$EXISTING_PID" 2>/dev/null || true
    sleep 1
fi

# Start frontend server in background
cd "$SCRIPT_DIR"
echo "Starting frontend server from: $SCRIPT_DIR"

# Start npm run dev in background with proper environment
(
    cd "$SCRIPT_DIR"
    /opt/homebrew/bin/npm run dev > /tmp/floyd-desktop-frontend.log 2>&1
) &
NPM_PID=$!

echo "Server starting with PID: $NPM_PID"

# Wait for server to be ready
echo "Waiting for frontend to start..."
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL" 2>/dev/null | grep -q "200"; then
        echo "✓ Frontend started!"
        break
    fi
    # Show a dot every second to indicate we're waiting
    echo -n "."
    sleep 1
done
echo ""

# Verify it started
if ! curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL" 2>/dev/null | grep -q "200"; then
    echo "⚠ Server did not start properly. Check logs: /tmp/floyd-desktop-frontend.log"
    cat /tmp/floyd-desktop-frontend.log
    rm -f "$LOCKFILE"
    exit 1
fi

# Open in browser
open "$SERVER_URL"

echo "Floyd Desktop is running at $SERVER_URL"
echo ""
echo "The server is running in the background."
echo "To stop it later, run: lsof -ti:5173 | xargs kill"
echo ""

# Clean up lock file
rm -f "$LOCKFILE"

# Keep window open briefly for user to see messages
sleep 5
