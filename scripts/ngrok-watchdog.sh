#!/bin/bash
# Floyd Desktop Ngrok Tunnel Watchdog
# Self-healing tunnel manager for mobile access
# Ensures robust connection for Mobile PWA

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
NGROK_DOMAIN="floyd-mobile"
NGROK_PORT=5173
CHECK_INTERVAL=30
MAX_RETRIES=3
STARTUP_WAIT=15

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M-%S')] WARN:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Get ngrok tunnel URL
get_ngrok_url() {
    curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | \
        python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for t in data.get('tunnels', []):
        if t.get('name') == 'command_line' or 'https://' in t.get('public_url', ''):
            print(t['public_url'])
            break
except:
    pass
" 2>/dev/null || echo ""
}

# Check if local server is running
check_local_server() {
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:$NGROK_PORT 2>/dev/null || echo "000")
    [ "$status" = "200" ]
}

# Check if ngrok tunnel is healthy
check_tunnel() {
    local url="https://${NGROK_DOMAIN}.ngrok-free.app"
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    [ "$status" = "200" ]
}

# Kill existing ngrok processes
kill_ngrok() {
    log_info "Stopping existing ngrok processes..."
    pkill -f "ngrok http" 2>/dev/null || true
    sleep 2
}

# Start ngrok tunnel
start_ngrok() {
    log_info "Starting ngrok tunnel..."
    ngrok http $NGROK_PORT --domain=${NGROK_DOMAIN}.ngrok-free.app &
    log_info "Waiting ${STARTUP_WAIT}s for tunnel to establish..."
    sleep $STARTUP_WAIT
    
    local url
    url=$(get_ngrok_url)
    if [ -n "$url" ]; then
        log_info "Tunnel established: $url"
    else
        log_error "Failed to establish tunnel"
        return 1
    fi
}

# Restart everything
full_restart() {
    log_warn "Initiating full restart..."
    
    # Kill existing
    kill_ngrok
    
    # Check local server
    if ! check_local_server; then
        log_error "Local server not running on port $NGROK_PORT"
        log_error "Please start the Floyd Desktop server first"
        return 1
    fi
    
    # Start ngrok
    start_ngrok
}

# Health check
health_check() {
    local retries=0
    
    # Check local server first
    if ! check_local_server; then
        log_error "Local server unhealthy"
        return 1
    fi
    
    # Check tunnel with retries
    while [ $retries -lt $MAX_RETRIES ]; do
        if check_tunnel; then
            return 0
        fi
        retries=$((retries + 1))
        log_warn "Tunnel check failed, retry $retries/$MAX_RETRIES"
        sleep 5
    done
    
    return 1
}

# Main loop
main() {
    log_info "=========================================="
    log_info "Floyd Desktop Ngrok Watchdog Started"
    log_info "Domain: ${NGROK_DOMAIN}.ngrok-free.app"
    log_info "Local Port: $NGROK_PORT"
    log_info "Check Interval: ${CHECK_INTERVAL}s"
    log_info "=========================================="
    
    # Initial startup
    if ! health_check; then
        log_warn "Initial health check failed, attempting restart..."
        if ! full_restart; then
            log_error "Failed to start tunnel. Exiting."
            exit 1
        fi
    fi
    
    # Main monitoring loop
    while true; do
        if health_check; then
            log_info "✓ Tunnel healthy"
        else
            log_warn "✗ Tunnel unhealthy, attempting recovery..."
            
            # Try simple restart first
            kill_ngrok
            sleep 3
            
            if ! health_check; then
                log_error "Simple restart failed, doing full restart..."
                if ! full_restart; then
                    log_error "Recovery failed, will retry in next cycle..."
                fi
            fi
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Handle signals
trap 'log_info "Received signal, shutting down..."; exit 0' SIGINT SIGTERM

# Run main
main "$@"
