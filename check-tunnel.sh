#!/bin/bash
# Health check script for Floyd Desktop ngrok tunnel

echo "Floyd Desktop Tunnel Health Check"
echo "=================================="
echo ""

# Check local server
LOCAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
echo "Local server (localhost:5173): $LOCAL_CODE"

# Check ngrok tunnel
TUNNEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://floyd-mobile.ngrok-free.app 2>&1)
echo "Ngrok tunnel (floyd-mobile.ngrok-free.app): $TUNNEL_CODE"

# Check if it's actually Floyd Desktop
CONTENT=$(curl -s https://floyd-mobile.ngrok-free.app)
if echo "$CONTENT" | grep -q "Floyd Desktop"; then
    echo "Content: ✓ Floyd Desktop detected"
else
    echo "Content: ✗ Wrong application (need to restart from FloydDesktopWeb-v2)"
fi

# Check ngrok status
echo ""
echo "Ngrok tunnel status:"
curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for t in data.get('tunnels', []):
        if t['name'] == 'floyd-mobile':
            print(f\"  Name: {t['name']}\")
            print(f\"  Public URL: {t['public_url']}\")
            print(f\"  Local: {t['config']['addr']}\")
            print(f\"  Connections: {t['metrics']['conns']['count']}\")
except:
    print('  Unable to fetch tunnel details')
" 2>/dev/null || echo "  (ngrok API not accessible)"

echo ""
if [ "$LOCAL_CODE" = "200" ] && [ "$TUNNEL_CODE" = "200" ]; then
    echo "Status: ✓ All systems operational"
    exit 0
else
    echo "Status: ✗ Issues detected"
    exit 1
fi
