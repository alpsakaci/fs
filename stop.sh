#!/bin/bash

# Safely switch to the project directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="$SCRIPT_DIR/nas.pid"

echo "=================================================="
echo "          MOBILE NAS STOP DAEMON                  "
echo "=================================================="

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    
    if kill -0 "$PID" 2>/dev/null; then
        echo "[*] Found active Mobile NAS process (PID: $PID)"
        echo "[*] Sending terminate signal..."
        kill "$PID"
        
        # Wait up to 5 seconds for the process to exit
        for i in {1..5}; do
            if ! kill -0 "$PID" 2>/dev/null; then
                break
            fi
            sleep 1
        done
        
        if kill -0 "$PID" 2>/dev/null; then
            echo "[!] Server did not exit, forcing shutdown..."
            kill -9 "$PID"
        fi
        
        echo "[+] Mobile NAS stopped successfully."
    else
        echo "[!] Process (PID: $PID) is not running."
    fi
    
    rm -f "$PID_FILE"
else
    echo "[!] No active Mobile NAS PID file found ($PID_FILE)."
    echo "[*] If the server is running on port 8080, check running processes manually."
fi
echo "=================================================="
