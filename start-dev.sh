#!/bin/bash
# Floyd Desktop Development Server Startup
# Ensures the Vite dev server runs from the correct directory for ngrok tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Floyd Desktop Development Server..."
echo "Directory: $SCRIPT_DIR"
echo "Port: 5173"
echo "Ngrok tunnel: https://floyd-mobile.ngrok-free.app"
echo ""

# Kill any existing process on port 5173
EXISTING_PID=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
    echo "Killing existing process on port 5173 (PID: $EXISTING_PID)"
    kill "$EXISTING_PID" 2>/dev/null || true
    sleep 1
fi

# Start the dev server
npm run dev
