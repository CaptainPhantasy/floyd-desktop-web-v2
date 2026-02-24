#!/bin/bash
#
# Floyd Ngrok Watchdog - Self-healing tunnel monitor
# Restarts ngrok tunnels if they die
#

LOG_FILE="/tmp/floyd-ngrok-watchdog.log"
NGROK_API="http://localhost:4040/api/tunnels"
CHECK_INTERVAL=30

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_ngrok() {
    # Check if ngrok process is running
    if ! pgrep -f "ngrok" > /dev/null; then
        return 1
    fi
    
    # Check if API responds
    if ! curl -s --connect-timeout 5 "$NGROK_API" > /dev/null 2>&1; then
        return 1
    fi
    
    # Check if floyd-api tunnel exists
    TUNNELS=$(curl -s "$NGROK_API" 2>/dev/null)
    if ! echo "$TUNNELS" | grep -q "floyd-api"; then
        return 1
    fi
    
    return 0
}

start_ngrok() {
    log "Starting ngrok tunnels..."
    
    # Kill any zombie ngrok processes
    pkill -9 ngrok 2>/dev/null
    sleep 1
    
    # Start ngrok with all tunnels
    ngrok start --all --log=stdout > /tmp/ngrok.log 2>&1 &
    
    # Wait for ngrok to initialize
    sleep 3
    
    if check_ngrok; then
        log "Ngrok started successfully"
        return 0
    else
        log "ERROR: Failed to start ngrok"
        return 1
    fi
}

send_notification() {
    # Optional: Send notification on failure
    # Can integrate with Slack, Discord, etc.
    log "NOTIFICATION: $1"
}

# Main watchdog loop
log "Floyd Ngrok Watchdog started"

while true; do
    if ! check_ngrok; then
        log "Ngrok tunnel down! Attempting restart..."
        send_notification "Ngrok tunnel down, restarting..."
        
        if start_ngrok; then
            send_notification "Ngrok tunnel restored"
        else
            send_notification "CRITICAL: Failed to restore ngrok tunnel"
        fi
    fi
    
    sleep $CHECK_INTERVAL
done
