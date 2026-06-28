#!/bin/bash

# Safely switch to the project directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================="
echo "          MOBILE NAS STARTUP DAEMON               "
echo "=================================================="

# Check if server is already running
PID_FILE="$SCRIPT_DIR/nas.pid"
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "[!] Mobile NAS is already running (PID: $OLD_PID)"
        echo "[*] Use 'kill $OLD_PID' to stop it before running again."
        exit 1
    fi
fi

# Source virtual environment
if [ -f "$SCRIPT_DIR/venv/bin/activate" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
    echo "[*] Activated virtual environment"
else
    echo "[!] Virtual environment activate script not found. Using system environment."
fi

# Log file config
LOG_FILE="$SCRIPT_DIR/nas.log"

# Run the Python NAS server in detached mode (in the background)
echo "[*] Launching NAS Server in detached mode..."
nohup python "$SCRIPT_DIR/main.py" "$@" > "$LOG_FILE" 2>&1 &
NEW_PID=$!

# Save PID to file
echo "$NEW_PID" > "$PID_FILE"

echo "--------------------------------------------------"
echo "[+] Mobile NAS successfully started!"
echo "[+] Process ID (PID): $NEW_PID"
echo "[+] Logs are written to: $LOG_FILE"
echo "[*] To stop the server, run: kill $NEW_PID"
echo "=================================================="
