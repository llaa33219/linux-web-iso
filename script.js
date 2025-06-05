// API 엔드포인트
const API_BASE = '/api';

// DOM 요소들
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const filesList = document.getElementById('filesList');
const toast = document.getElementById('toast');

// 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    refreshFileList();
});

function initializeEventListeners() {
    // 파일 선택 이벤트
    fileInput.addEventListener('change', handleFileSelect);
    
    // 드래그 앤 드롭 이벤트
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // 클릭 이벤트
    uploadArea.addEventListener('click', () => fileInput.click());
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.name.toLowerCase().endsWith('.iso')
    );
    
    if (files.length > 0) {
        uploadFiles(files);
    } else {
        showToast('ISO 파일만 업로드 가능합니다.', 'error');
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        uploadFiles(files);
    }
}

async function uploadFiles(files) {
    for (let i = 0; i < files.length; i++) {
        await uploadFile(files[i], i + 1, files.length);
    }
    refreshFileList();
}

async function uploadFile(file, current, total) {
    const formData = new FormData();
    formData.append('file', file);
    
    uploadProgress.style.display = 'block';
    
    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            showToast(`${file.name} 업로드 완료! (${current}/${total})`, 'success');
        } else {
            const error = await response.text();
            showToast(`업로드 실패: ${error}`, 'error');
        }
    } catch (error) {
        showToast(`업로드 에러: ${error.message}`, 'error');
    }
    
    // 진행률 초기화
    setTimeout(() => {
        uploadProgress.style.display = 'none';
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
    }, 1000);
}

async function refreshFileList() {
    filesList.innerHTML = '<div class="loading">파일 목록을 불러오는 중...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/files`);
        const files = await response.json();
        
        if (files.length === 0) {
            filesList.innerHTML = '<div class="loading">업로드된 ISO 파일이 없습니다.</div>';
            return;
        }
        
        filesList.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-icon">💿</div>
                    <div class="file-details">
                        <h3>${file.name}</h3>
                        <div class="file-meta">
                            <span>📏 ${formatFileSize(file.size)}</span>
                            <span>📅 ${formatDate(file.lastModified)}</span>
                        </div>
                    </div>
                </div>
                <div class="file-actions">
                    <a href="${API_BASE}/download/${encodeURIComponent(file.name)}" 
                       class="btn-download" target="_blank">
                        ⬇️ 다운로드
                    </a>
                    <button class="btn-danger" onclick="deleteFile('${file.name}')">
                        🗑️ 삭제
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        filesList.innerHTML = '<div class="loading">파일 목록을 불러오는데 실패했습니다.</div>';
        showToast(`목록 로드 에러: ${error.message}`, 'error');
    }
}

async function deleteFile(fileName) {
    if (!confirm(`"${fileName}" 파일을 삭제하시겠습니까?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/delete/${encodeURIComponent(fileName)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast(`${fileName} 삭제 완료!`, 'success');
            refreshFileList();
        } else {
            const error = await response.text();
            showToast(`삭제 실패: ${error}`, 'error');
        }
    } catch (error) {
        showToast(`삭제 에러: ${error.message}`, 'error');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR');
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
} 