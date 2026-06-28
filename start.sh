#!/bin/bash

# Safely switch to the project directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================="
echo "          MOBILE NAS STARTUP DAEMON               "
echo "=================================================="

# Check and activate local virtual environment if it exists
if [ -d "$SCRIPT_DIR/venv" ]; then
    PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
    echo "[*] Virtual environment detected: Using local venv Python"
else
    PYTHON_BIN="python3"
    echo "[!] Virtual environment NOT detected: Falling back to system python3"
fi

# Print startup info
echo "[*] Initializing server bootstrapper..."
echo "[*] Access point will be on port 8080"
echo "--------------------------------------------------"

# Run the Python NAS server, forwarding all CLI arguments (like -d /root/downloads)
# Using exec ensures CTRL+C signal is passed directly to Python for clean exit
exec "$PYTHON_BIN" "$SCRIPT_DIR/main.py" "$@"
