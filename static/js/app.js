// Mobile NAS Application Controller

// State Management
let currentPath = '';
let filesList = [];
let targetItemPath = ''; // used for rename / delete operations
let uploadXhr = null; // hold current upload request

// SVG Icons Dictionary
const ICONS = {
    folder: `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
    image: `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
    video: `<svg viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>`,
    audio: `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
    text: `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
    document: `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`,
    archive: `<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10h-4v-2h4v2zm0-4h-4V8h4v4z"/></svg>`,
    other: `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>`
};

// Initialization on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch of directory content and statistics
    loadDirectory(currentPath);
    fetchStats();
    
    // Periodically poll stats every 5 seconds
    setInterval(fetchStats, 5000);
    
    // Register UI Event Listeners
    setupEventHandlers();
});

// Setup Page Elements Event Handlers
function setupEventHandlers() {
    // 1. Search Box Filtering
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        filterFiles(e.target.value);
    });

    // 2. Folder Creation Modal Triggers
    document.getElementById('btn-new-folder').addEventListener('click', () => {
        openModal('modal-folder');
        document.getElementById('folder-name-input').focus();
    });
    
    document.getElementById('btn-confirm-folder').addEventListener('click', () => {
        const folderName = document.getElementById('folder-name-input').value.trim();
        if (folderName) {
            createFolder(folderName);
        } else {
            alert('Folder name cannot be empty');
        }
    });

    // 3. Rename Confirmation Trigger
    document.getElementById('btn-confirm-rename').addEventListener('click', () => {
        const newName = document.getElementById('rename-input').value.trim();
        if (newName) {
            renameItem(targetItemPath, newName);
        } else {
            alert('New name cannot be empty');
        }
    });

    // 4. Delete Confirmation Trigger
    document.getElementById('btn-confirm-delete').addEventListener('click', () => {
        deleteItem(targetItemPath);
    });

    // 5. Text File Saving Trigger
    document.getElementById('btn-editor-save').addEventListener('click', () => {
        const textContent = document.getElementById('editor-textarea').value;
        saveTextFile(targetItemPath, textContent);
    });

    // 6. Generic Modal Close buttons (data-close attributes)
    document.querySelectorAll('[data-close]').forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-close');
            closeModal(modalId);
        });
    });

    // Close preview media modal specifically handles stopping videos/audios from playing in background
    const closePreviewBtns = [
        document.getElementById('btn-preview-close'),
        document.getElementById('btn-preview-close-footer')
    ];
    closePreviewBtns.forEach(btn => {
        if(btn) {
            btn.addEventListener('click', () => {
                const container = document.getElementById('preview-container');
                container.innerHTML = ''; // tear down player to kill audio stream
                closeModal('modal-preview');
            });
        }
    });

    // 7. File Input Upload Trigger
    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFiles(e.target.files);
        }
    });

    // 8. Drag and Drop Upload Event Hooks
    const dropzone = document.getElementById('dropzone');
    
    // Highlight dropzone on drag enter/over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        }, false);
    });

    // Unhighlight dropzone on drag leave/drop
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            uploadFiles(files);
        }
    }, false);
}

// -------------------------------------------------------------
// CORE OPERATION METHODS
// -------------------------------------------------------------

// Load folder items from FastAPI server
async function loadDirectory(path) {
    currentPath = path;
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<div class="empty-explorer"><p>Loading files...</p></div>';
    
    try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to fetch files');
        }
        
        const data = await response.json();
        filesList = data.items;
        renderFiles(filesList);
        renderBreadcrumbs(path);
        
        // Reset Search Input on Navigation
        document.getElementById('search-input').value = '';
        
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<div class="empty-explorer"><p style="color: var(--danger)">Error: ${error.message}</p></div>`;
    }
}

// Render folder tree elements in browser
function renderFiles(items) {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '';
    
    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-explorer">
                <svg class="empty-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.31c-.398 0-.781-.158-1.062-.44z"></path>
                </svg>
                <h3>This folder is empty</h3>
                <p>Drag files here or tap Upload to get started.</p>
            </div>
        `;
        return;
    }
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `file-card type-${item.type}`;
        
        // Build card body
        card.innerHTML = `
            <div class="file-icon">
                ${ICONS[item.type] || ICONS.other}
            </div>
            <div class="file-info">
                <div class="file-name" title="${item.name}">${item.name}</div>
                <div class="file-meta">
                    <span>${item.is_dir ? 'Folder' : formatSize(item.size)}</span>
                    <span>${formatTime(item.mtime)}</span>
                </div>
            </div>
            <div class="file-actions">
                ${!item.is_dir ? `
                    <button class="action-btn btn-download" title="Download">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12"></path>
                        </svg>
                    </button>
                ` : ''}
                <button class="action-btn btn-rename" title="Rename">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                </button>
                <button class="action-btn btn-delete" title="Delete">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Double-click or single-click folder/preview behavior
        card.addEventListener('click', (e) => {
            // Ignore if action button clicked
            if (e.target.closest('.file-actions') || e.target.closest('.action-btn')) {
                return;
            }
            
            if (item.is_dir) {
                loadDirectory(item.path);
            } else {
                openPreview(item);
            }
        });
        
        // Bind actions click events
        if (!item.is_dir) {
            card.querySelector('.btn-download').addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(`/api/download?path=${encodeURIComponent(item.path)}`, '_blank');
            });
        }
        
        card.querySelector('.btn-rename').addEventListener('click', (e) => {
            e.stopPropagation();
            targetItemPath = item.path;
            document.getElementById('rename-input').value = item.name;
            openModal('modal-rename');
            document.getElementById('rename-input').focus();
        });
        
        card.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            targetItemPath = item.path;
            document.getElementById('delete-item-name').innerText = item.name;
            openModal('modal-delete');
        });
        
        grid.appendChild(card);
    });
}

// Generate breadcrumbs clickable trail
function renderBreadcrumbs(path) {
    const container = document.getElementById('breadcrumbs');
    container.innerHTML = '';
    
    // Add Root breadcrumb
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.innerText = 'Shared Root';
    rootItem.addEventListener('click', () => loadDirectory(''));
    container.appendChild(rootItem);
    
    if (!path) {
        rootItem.className = 'breadcrumb-item active';
        return;
    }
    
    const parts = path.split('/');
    let accumPath = '';
    
    parts.forEach((part, index) => {
        // Add separator
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.innerText = ' / ';
        container.appendChild(separator);
        
        accumPath += (index === 0 ? '' : '/') + part;
        const currentAccum = accumPath; // lock closure value
        
        const item = document.createElement('span');
        item.className = 'breadcrumb-item';
        item.innerText = part;
        
        if (index === parts.length - 1) {
            item.className = 'breadcrumb-item active';
        } else {
            item.addEventListener('click', () => loadDirectory(currentAccum));
        }
        
        container.appendChild(item);
    });
}

// local search filter
function filterFiles(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        renderFiles(filesList);
        return;
    }
    const filtered = filesList.filter(item => item.name.toLowerCase().includes(q));
    renderFiles(filtered);
}

// Create Directory
async function createFolder(name) {
    const formData = new FormData();
    formData.append('path', currentPath);
    formData.append('name', name);
    
    try {
        const response = await fetch('/api/mkdir', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Folder creation failed');
        }
        
        closeModal('modal-folder');
        document.getElementById('folder-name-input').value = '';
        loadDirectory(currentPath);
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Delete Item
async function deleteItem(path) {
    const formData = new FormData();
    formData.append('path', path);
    
    try {
        const response = await fetch('/api/delete', {
            method: 'DELETE',
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Delete failed');
        }
        
        closeModal('modal-delete');
        loadDirectory(currentPath);
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Rename Item
async function renameItem(path, newName) {
    const formData = new FormData();
    formData.append('path', path);
    formData.append('new_name', newName);
    
    try {
        const response = await fetch('/api/rename', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Rename failed');
        }
        
        closeModal('modal-rename');
        document.getElementById('rename-input').value = '';
        loadDirectory(currentPath);
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Upload Files utilizing XMLHttpRequest for progress bar tracking
function uploadFiles(files) {
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const percentageText = document.getElementById('upload-percentage');
    const statusText = document.getElementById('upload-status-text');
    const speedText = document.getElementById('upload-speed-text');
    const remainingText = document.getElementById('upload-remaining-text');
    
    progressContainer.style.display = 'block';
    
    const formData = new FormData();
    formData.append('path', currentPath);
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    
    uploadXhr = new XMLHttpRequest();
    uploadXhr.open('POST', '/api/upload', true);
    
    let startTime = Date.now();
    
    // Upload Progress handler
    uploadXhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percentComplete + '%';
            percentageText.innerText = percentComplete + '%';
            
            // Calculate Upload Speed & ETA
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const bytesPerSecond = e.loaded / (elapsedSeconds || 1);
            const speedKB = bytesPerSecond / 1024;
            
            if (speedKB > 1024) {
                speedText.innerText = (speedKB / 1024).toFixed(1) + ' MB/s';
            } else {
                speedText.innerText = speedKB.toFixed(1) + ' KB/s';
            }
            
            const remainingBytes = e.total - e.loaded;
            const remainingSeconds = Math.round(remainingBytes / (bytesPerSecond || 1));
            
            if (percentComplete === 100) {
                statusText.innerText = 'Processing file(s)...';
                remainingText.innerText = 'Finishing up';
            } else {
                statusText.innerText = `Uploading ${files.length} file(s)...`;
                remainingText.innerText = formatTimeDuration(remainingSeconds) + ' remaining';
            }
        }
    };
    
    // Success / Completed callback
    uploadXhr.onload = () => {
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        percentageText.innerText = '0%';
        
        if (uploadXhr.status === 200) {
            loadDirectory(currentPath);
        } else {
            let errMsg = 'Upload failed';
            try {
                const res = JSON.parse(uploadXhr.responseText);
                errMsg = res.detail || errMsg;
            } catch (err) {}
            alert('Upload failed: ' + errMsg);
        }
        uploadXhr = null;
    };
    
    // Error callback
    uploadXhr.onerror = () => {
        progressContainer.style.display = 'none';
        alert('Network upload error occurred.');
        uploadXhr = null;
    };
    
    uploadXhr.send(formData);
}

// -------------------------------------------------------------
// PREVIEW AND CODE EDITOR
// -------------------------------------------------------------

// Open Media Preview or Text Editor based on file classification type
async function openPreview(item) {
    targetItemPath = item.path;
    
    if (item.type === 'text') {
        openTextEditor(item);
        return;
    }
    
    const title = document.getElementById('preview-title');
    const container = document.getElementById('preview-container');
    const dlBtn = document.getElementById('btn-preview-download');
    
    title.innerText = item.name;
    dlBtn.href = `/api/download?path=${encodeURIComponent(item.path)}`;
    
    container.innerHTML = ''; // reset preview layout
    
    const encodedPath = encodeURIComponent(item.path);
    const mediaUrl = `/api/download?path=${encodedPath}`;
    
    if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.alt = item.name;
        container.appendChild(img);
        openModal('modal-preview');
    } else if (item.type === 'video') {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.controls = true;
        video.autoplay = true;
        container.appendChild(video);
        openModal('modal-preview');
    } else if (item.type === 'audio') {
        const audio = document.createElement('audio');
        audio.src = mediaUrl;
        audio.controls = true;
        audio.autoplay = true;
        container.appendChild(audio);
        openModal('modal-preview');
    } else {
        // Fallback for document, archive, or other files (automatic triggers download direct link)
        window.open(mediaUrl, '_blank');
    }
}

// Open Text file editor
async function openTextEditor(item) {
    try {
        const response = await fetch(`/api/text?path=${encodeURIComponent(item.path)}`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Could not load file text');
        }
        
        const data = await response.json();
        document.getElementById('editor-title').innerText = `Edit: ${item.name}`;
        document.getElementById('editor-textarea').value = data.content;
        
        openModal('modal-editor');
    } catch (error) {
        alert('Failed to edit: ' + error.message);
    }
}

// Write/Save Text file
async function saveTextFile(path, content) {
    const formData = new FormData();
    formData.append('path', path);
    formData.append('content', content);
    
    try {
        const response = await fetch('/api/text', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Save failed');
        }
        
        closeModal('modal-editor');
        loadDirectory(currentPath);
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// -------------------------------------------------------------
// SYSTEM METRICS POLL
// -------------------------------------------------------------

// Fetch system storage/memory/CPU stats from API
async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) return;
        
        const stats = await response.json();
        
        // 1. CPU Stat Update
        const cpuNode = document.getElementById('cpu-stat');
        cpuNode.querySelector('.percent-val').innerText = Math.round(stats.cpu) + '%';
        cpuNode.querySelector('.stat-bar').style.width = stats.cpu + '%';
        cpuNode.querySelector('.stat-detail').innerText = `${stats.system.cpu_count} Cores (${stats.system.platform})`;

        // 2. RAM Stat Update
        const ramUsedGB = (stats.memory.used / (1024 ** 3)).toFixed(1);
        const ramTotalGB = (stats.memory.total / (1024 ** 3)).toFixed(1);
        const ramNode = document.getElementById('ram-stat');
        ramNode.querySelector('.percent-val').innerText = stats.memory.percent + '%';
        ramNode.querySelector('.stat-bar').style.width = stats.memory.percent + '%';
        ramNode.querySelector('.stat-detail').innerText = `${ramUsedGB} GB / ${ramTotalGB} GB`;

        // 3. Disk Stat Update
        const diskUsedGB = (stats.disk.used / (1024 ** 3)).toFixed(1);
        const diskTotalGB = (stats.disk.total / (1024 ** 3)).toFixed(1);
        const diskNode = document.getElementById('disk-stat');
        diskNode.querySelector('.percent-val').innerText = stats.disk.percent + '%';
        diskNode.querySelector('.stat-bar').style.width = stats.disk.percent + '%';
        diskNode.querySelector('.stat-detail').innerText = `${diskUsedGB} GB / ${diskTotalGB} GB`;

    } catch (error) {
        console.warn('Could not update telemetry statistics', error);
    }
}

// -------------------------------------------------------------
// UTILITY FUNCTIONS
// -------------------------------------------------------------

// Helper to open a modal
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('open');
    }
}

// Helper to close a modal
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('open');
    }
}

// Format byte size to readable units
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Format timestamp to date time
function formatTime(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Format duration seconds to text
function formatTimeDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return 'calculating...';
    if (seconds === Infinity) return 'long time';
    if (seconds < 60) return seconds + 's';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes + 'm ' + secs + 's';
}
