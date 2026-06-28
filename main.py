import os
import sys
import shutil
import psutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
import mimetypes
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

# Initialize mimetypes database
mimetypes.init()

# Custom FileResponse to increase chunk size to 1MB for fast local network downloads
class FastFileResponse(FileResponse):
    chunk_size = 1024 * 1024  # 1MB chunks (Starlette default is 64KB)

# Initialize FastAPI App
app = FastAPI(title="Mobile NAS File Server")

# Enable CORS for local network development ease
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared Directory Config
# Can be configured via command-line argument (--dir / -d) or env variable (NAS_SHARED_DIR)
# Default is the "shared" directory in the project root
shared_dir_arg = None
for idx, arg in enumerate(sys.argv):
    if arg in ("--dir", "-d") and idx + 1 < len(sys.argv):
        shared_dir_arg = sys.argv[idx + 1]
        break

SHARED_DIR = shared_dir_arg or os.getenv("NAS_SHARED_DIR", str(Path(__file__).parent / "shared"))
SHARED_PATH = Path(SHARED_DIR).resolve()

try:
    SHARED_PATH.mkdir(parents=True, exist_ok=True)
except PermissionError:
    print(f"\n[ERROR] Permission denied when creating/accessing: {SHARED_PATH}")
    print("Please check your user permissions or run with appropriate access (e.g., sudo).\n")
    sys.exit(1)

# Initialize psutil CPU reading
psutil.cpu_percent(interval=None)

# Helper function to prevent path traversal vulnerability
def get_safe_path(subpath: str) -> Path:
    # Remove leading slashes and resolve
    clean_subpath = subpath.lstrip("/")
    target = (SHARED_PATH / clean_subpath).resolve()
    
    # Check if the target is inside SHARED_PATH
    if not target.is_relative_to(SHARED_PATH):
        raise HTTPException(status_code=403, detail="Access denied: Path lies outside the shared directory.")
    return target

# File classification helper
def get_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    categories = {
        'image': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'],
        'video': ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.wmv', '.3gp'],
        'audio': ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'],
        'text': ['.txt', '.md', '.py', '.js', '.css', '.html', '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.sh', '.bat', '.gitignore', '.env'],
        'document': ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'],
        'archive': ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz']
    }
    for category, extensions in categories.items():
        if ext in extensions:
            return category
    return 'other'

# 1. API: List Files and Folders
@app.get("/api/files")
async def list_files(path: str = ""):
    target_dir = get_safe_path(path)
    if not target_dir.exists():
        raise HTTPException(status_code=404, detail="Directory not found")
    if not target_dir.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    
    items = []
    try:
        for item in target_dir.iterdir():
            # Get relative path for client consumption
            rel_path = str(item.relative_to(SHARED_PATH))
            if rel_path == ".":
                rel_path = ""
                
            is_dir = item.is_dir()
            size = 0
            file_type = "folder"
            
            if not is_dir:
                try:
                    size = item.stat().st_size
                    file_type = get_file_type(item.name)
                except Exception:
                    pass
            
            try:
                mtime = item.stat().st_mtime
            except Exception:
                mtime = 0
                
            items.append({
                "name": item.name,
                "path": rel_path,
                "is_dir": is_dir,
                "size": size,
                "mtime": mtime,
                "type": file_type
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read folder contents: {str(e)}")
        
    # Sort: directories first, then alphabetically by name
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    
    return {
        "current_path": path,
        "items": items
    }

# 2. API: Create Directory
@app.post("/api/mkdir")
async def create_directory(path: str = Form(""), name: str = Form(...)):
    parent_dir = get_safe_path(path)
    if not parent_dir.is_dir():
        raise HTTPException(status_code=400, detail="Target path is not a directory")
    
    # Strip whitespace and check folder name validity
    name = name.strip()
    if not name or "/" in name or "\\" in name or name == "." or name == "..":
        raise HTTPException(status_code=400, detail="Invalid folder name")
        
    new_dir = parent_dir / name
    if new_dir.exists():
        raise HTTPException(status_code=400, detail="A folder or file with this name already exists")
        
    try:
        new_dir.mkdir(exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create directory: {str(e)}")
        
    return {"status": "success", "message": "Directory created successfully"}

# 3. API: Upload File(s)
@app.post("/api/upload")
async def upload_files(path: str = Form(""), files: list[UploadFile] = File(...)):
    target_dir = get_safe_path(path)
    if not target_dir.is_dir():
        raise HTTPException(status_code=400, detail="Target path is not a directory")
        
    saved_files = []
    try:
        for file in files:
            # Prevent empty or malicious file names
            filename = file.filename
            if not filename or "/" in filename or "\\" in filename:
                continue
                
            dest_path = target_dir / filename
            
            # Save file in 1MB chunks
            with open(dest_path, "wb") as buffer:
                while chunk := await file.read(1024 * 1024):
                    buffer.write(chunk)
            
            saved_files.append(filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
        
    return {
        "status": "success",
        "message": f"Successfully uploaded {len(saved_files)} file(s)",
        "files": saved_files
    }

# 4. API: Download File
@app.get("/api/download")
async def download_file(path: str, inline: bool = False):
    target_file = get_safe_path(path)
    if not target_file.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target_file.is_file():
        raise HTTPException(status_code=400, detail="Requested path is not a file")
        
    # Guess mime type dynamically
    mime_type, _ = mimetypes.guess_type(str(target_file))
    if not mime_type:
        mime_type = "application/octet-stream"
        
    headers = {}
    if inline:
        headers["Content-Disposition"] = "inline"
        
    return FastFileResponse(
        path=target_file,
        filename=target_file.name if not inline else None,
        media_type=mime_type,
        headers=headers
    )

# 5. API: Delete File/Folder
@app.delete("/api/delete")
async def delete_item(path: str = Form(...)):
    target = get_safe_path(path)
    
    # Safety check: Don't allow deleting the root shared directory itself
    if target == SHARED_PATH:
        raise HTTPException(status_code=400, detail="Cannot delete root shared directory")
        
    if not target.exists():
        raise HTTPException(status_code=404, detail="Item not found")
        
    try:
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
        
    return {"status": "success", "message": f"Successfully deleted {target.name}"}

# 6. API: Rename File/Folder
@app.post("/api/rename")
async def rename_item(path: str = Form(...), new_name: str = Form(...)):
    target = get_safe_path(path)
    
    if target == SHARED_PATH:
        raise HTTPException(status_code=400, detail="Cannot rename root shared directory")
        
    if not target.exists():
        raise HTTPException(status_code=404, detail="Item not found")
        
    new_name = new_name.strip()
    if not new_name or "/" in new_name or "\\" in new_name or new_name == "." or new_name == "..":
        raise HTTPException(status_code=400, detail="Invalid name")
        
    new_path = target.parent / new_name
    
    # Extra check: make sure new path resides in shared path
    if not new_path.resolve().is_relative_to(SHARED_PATH):
        raise HTTPException(status_code=403, detail="Access denied")
        
    if new_path.exists():
        raise HTTPException(status_code=400, detail="An item with the new name already exists")
        
    try:
        target.rename(new_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rename failed: {str(e)}")
        
    return {"status": "success", "message": f"Successfully renamed to {new_name}"}

# 7. API: Get Text File Content
@app.get("/api/text")
async def get_text_file(path: str):
    target = get_safe_path(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Requested path is not a file")
        
    try:
        content = target.read_text(encoding="utf-8")
        return {"content": content}
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="The file is not a valid text file or contains non-UTF-8 characters")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

# 8. API: Save Text File Content
@app.post("/api/text")
async def save_text_file(path: str = Form(...), content: str = Form("")):
    target = get_safe_path(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Target path is not a file")
        
    try:
        target.write_text(content, encoding="utf-8")
        return {"status": "success", "message": "File saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {str(e)}")

# 9. API: System Statistics
@app.get("/api/stats")
async def get_stats():
    try:
        # Get disk details for the shared directory drive
        disk = psutil.disk_usage(SHARED_DIR)
        # Get memory details
        mem = psutil.virtual_memory()
        # Get CPU load (non-blocking, reads interval since last check or returns historical value)
        cpu = psutil.cpu_percent(interval=None)
        
        return {
            "cpu": cpu,
            "memory": {
                "total": mem.total,
                "used": mem.used,
                "free": mem.available,
                "percent": mem.percent
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent
            },
            "system": {
                "platform": sys.platform,
                "cpu_count": psutil.cpu_count(),
                "shared_root": str(SHARED_PATH)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve system statistics: {str(e)}")

# 10. Web Interface routes
# Setup static files directory
STATIC_PATH = Path(__file__).parent / "static"
STATIC_PATH.mkdir(exist_ok=True)

# If index.html doesn't exist yet, we will map root directly
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_PATH / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return HTMLResponse("<h1>NAS Server running... Please wait for frontend deployment</h1>")

# Mount /static routing for JS and CSS files
app.mount("/static", StaticFiles(directory=str(STATIC_PATH)), name="static")

if __name__ == "__main__":
    import uvicorn
    # Listen on 0.0.0.0 (all interfaces) at port 8080
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
