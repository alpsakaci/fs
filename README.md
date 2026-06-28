# 📱 Mobile NAS (Network Attached Storage) System

A lightweight, responsive, and mobile-optimized NAS file server designed to run on phone-based Ubuntu environments (such as Termux, UserLAnd, or standard Linux/macOS systems). 

Built with **Python & FastAPI** on the backend and a premium **Vanilla JavaScript & CSS** single-page application (SPA) on the frontend.

---

## 🌟 Key Features

* **📊 Live Telemetry Dashboard**: Real-time monitoring of host system resource metrics including CPU load, RAM usage, and Shared Drive storage capacity.
* **📂 Responsive File Explorer**: Breadcrumb-based folder navigation, instant file searching, and list layouts styled with glowing folder and file-type icons.
* **⚡ High-Speed Local Transfers**: Optimized file chunk-size reading (1MB buffers) to maximize Wi-Fi network throughput and accelerate file downloads.
* **🎥 Range-Based Media Streaming**: Built-in HTML5 lightbox players for images, audio (MP3, WAV, etc.), and video (MP4, WEBM, MKV). Supports instant forward/backward seeking without downloading.
* **📝 In-Browser Code Editor**: Edit, view, and save text, markdown, configuration, or Python script files directly inside a courier-styled modal text editor.
* **☁️ Drag-and-Drop Upload Manager**: Upload multiple files simultaneously by dragging them onto the browser. Displays real-time upload progress, transfer speed, and remaining time.
* **⚙️ Background Service Management**: Control the server easily using detached background daemon scripts (`start.sh` and `stop.sh`).

---

## 📂 Directory Structure

```text
fs/
├── main.py              # FastAPI server containing API routes and paths validation
├── requirements.txt     # Python libraries list (FastAPI, uvicorn, psutil, etc.)
├── start.sh             # Detached background server startup script
├── stop.sh              # Server shutdown script
├── nas.log              # Logs output file (generated after starting)
├── nas.pid              # Process ID file tracker (generated after starting)
├── shared/              # Default shared folder where NAS files reside
└── static/              # Frontend client files
    ├── css/
    │   └── style.css    # Responsive glassmorphism stylesheet
    ├── js/
    │   └── app.js       # SPA framework controller (polling, uploads, rendering)
    └── index.html       # Web browser interface shell
```

---

## 🚀 Getting Started

### Prerequisites

* Python 3.9 or higher
* Active local network/Wi-Fi connection

### 1. Setup Environment

Clone or copy the directory onto your host Ubuntu device, and install dependencies into a virtual environment:

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 2. Start the Server

You can run the server in detached (background) mode using the provided bootstrapper:

```bash
# Shares the default directory (./shared)
./start.sh

# Or shares a custom directory (e.g. your downloads folder)
./start.sh --dir /root/downloads
```

The script will launch the FastAPI application on port **8080**, print the running PID, and route all console logs to `nas.log`.

### 3. Connect from Other Devices

1. Ensure the host device (e.g. your phone) and client device (computer, tablet, or another phone) are connected to the **same Wi-Fi network**.
2. Find the local IP address of your host phone (e.g., using `ip a` or `ifconfig`). Let's assume it is `192.168.1.50`.
3. Open a browser on the client device and go to:
   ```text
   http://192.168.1.50:8080
   ```

### 4. Stop the Server

To cleanly shutdown the server running in the background, run:

```bash
./stop.sh
```
