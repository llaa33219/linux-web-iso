// R2 버킷 바인딩 변수명: ISO_BUCKET
// wrangler.toml에서 다음과 같이 설정하세요:
// [[r2_buckets]]
// binding = "ISO_BUCKET"
// bucket_name = "linux-iso"

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Preflight 요청 처리
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API 라우팅
      if (path.startsWith('/api/')) {
        const apiPath = path.substring(4); // '/api/' 제거

        switch (true) {
          case apiPath === '/files' && request.method === 'GET':
            return await handleGetFiles(env.ISO_BUCKET, corsHeaders);

          case apiPath === '/upload' && request.method === 'POST':
            return await handleUpload(request, env.ISO_BUCKET, corsHeaders);

          case apiPath.startsWith('/download/') && request.method === 'GET':
            const downloadFileName = decodeURIComponent(apiPath.substring(10));
            return await handleDownload(downloadFileName, env.ISO_BUCKET, corsHeaders);

          case apiPath.startsWith('/delete/') && request.method === 'DELETE':
            const deleteFileName = decodeURIComponent(apiPath.substring(8));
            return await handleDelete(deleteFileName, env.ISO_BUCKET, corsHeaders);

          default:
            return new Response('Not Found', { 
              status: 404, 
              headers: corsHeaders 
            });
        }
      }

      // 정적 파일 제공 (index.html, CSS, JS)
      return await handleStaticFiles(request, env);

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(`Internal Server Error: ${error.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

// 파일 목록 조회
async function handleGetFiles(bucket, corsHeaders) {
  try {
    const objects = await bucket.list();
    
    const files = await Promise.all(
      objects.objects.map(async (obj) => {
        // 파일 메타데이터 가져오기
        const object = await bucket.head(obj.key);
        
        return {
          name: obj.key,
          size: obj.size || 0,
          lastModified: obj.uploaded || new Date().toISOString(),
          etag: object?.etag || ''
        };
      })
    );

    // ISO 파일만 필터링
    const isoFiles = files.filter(file => 
      file.name.toLowerCase().endsWith('.iso')
    );

    return new Response(JSON.stringify(isoFiles), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(`파일 목록 조회 실패: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
}

// 파일 업로드
async function handleUpload(request, bucket, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response('파일이 선택되지 않았습니다.', {
        status: 400,
        headers: corsHeaders
      });
    }

    // ISO 파일 확인
    if (!file.name.toLowerCase().endsWith('.iso')) {
      return new Response('ISO 파일만 업로드 가능합니다.', {
        status: 400,
        headers: corsHeaders
      });
    }

    // 파일 크기 제한 (예: 10GB)
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    if (file.size > maxSize) {
      return new Response('파일 크기가 너무 큽니다. (최대 10GB)', {
        status: 400,
        headers: corsHeaders
      });
    }

    // R2에 파일 업로드
    await bucket.put(file.name, file.stream(), {
      httpMetadata: {
        contentType: 'application/octet-stream',
        contentDisposition: `attachment; filename="${file.name}"`
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalName: file.name
      }
    });

    return new Response('업로드 완료', {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(`업로드 실패: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
}

// 파일 다운로드
async function handleDownload(fileName, bucket, corsHeaders) {
  try {
    const object = await bucket.get(fileName);
    
    if (!object) {
      return new Response('파일을 찾을 수 없습니다.', {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': object.size.toString(),
        ...corsHeaders
      }
    });

  } catch (error) {
    return new Response(`다운로드 실패: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
}

// 파일 삭제
async function handleDelete(fileName, bucket, corsHeaders) {
  try {
    // 파일 존재 여부 확인
    const object = await bucket.head(fileName);
    
    if (!object) {
      return new Response('파일을 찾을 수 없습니다.', {
        status: 404,
        headers: corsHeaders
      });
    }

    // 파일 삭제
    await bucket.delete(fileName);

    return new Response('삭제 완료', {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(`삭제 실패: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
}

// 정적 파일 제공
async function handleStaticFiles(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 기본 경로는 index.html로
  if (pathname === '/') {
    return new Response(`<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Linux ISO 관리자</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Linux ISO 관리</h1>
            <p>리눅스 실행기 iso관리</p>
        </header>

        <main>
            <!-- 업로드 섹션 -->
            <section class="upload-section">
                <h2>ISO 파일 업로드</h2>
                <div class="upload-area" id="uploadArea">
                    <div class="upload-content">
                        <div class="upload-icon"></div>
                        <p>ISO 파일을 드래그 앤 드롭하거나 클릭하여 선택하세요</p>
                        <input type="file" id="fileInput" accept=".iso" multiple style="display: none;">
                        <button class="btn-primary" onclick="document.getElementById('fileInput').click()">
                            파일 선택
                        </button>
                    </div>
                </div>
                <div id="uploadProgress" class="upload-progress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <span id="progressText">0%</span>
                </div>
            </section>

            <!-- 파일 목록 섹션 -->
            <section class="files-section">
                <div class="section-header">
                    <h2>ISO 파일 목록</h2>
                    <button class="btn-secondary" onclick="refreshFileList()">새로고침</button>
                </div>
                <div id="filesList" class="files-list">
                    <div class="loading">파일 목록을 불러오는 중...</div>
                </div>
            </section>
        </main>

        <!-- 토스트 알림 -->
        <div id="toast" class="toast"></div>
    </div>

    <script src="script.js"></script>
</body>
</html>`, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  // CSS 파일 제공
  if (pathname === '/style.css') {
    return new Response(`* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #ddd;
    min-height: 100vh;
    padding: 20px;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
}

header {
    text-align: center;
    margin-bottom: 40px;
    color: #000;
}

header h1 {
    font-size: 2.5rem;
    margin-bottom: 10px;
    color: #000;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

header p {
    font-size: 1.1rem;
    opacity: 0.9;
}

main {
    display: grid;
    gap: 30px;
}

section {
    background: white;
    border-radius: 16px;
    padding: 30px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

h2 {
    color: #333;
    font-size: 1.5rem;
}

.upload-area {
    border: 3px dashed #ddd;
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    transition: all 0.3s ease;
    cursor: pointer;
}

.upload-area:hover, .upload-area.dragover {
    border-color: #667eea;
    background-color: #f8f9ff;
}

.upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
}

.upload-icon {
    font-size: 3rem;
}

.upload-progress {
    margin-top: 20px;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background-color: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    width: 0%;
    transition: width 0.3s ease;
}

.btn-primary {
    background-color: #007BFF;
    color: white;
    border: none;
    border-radius: 20px;
    padding: 10px 20px;
    margin: 20px 0;
    width: 600px;
    height: 61px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: background-color 0.3s ease, transform 0.1s ease, box-shadow 0.3s ease;
    font-weight: bold;
    font-size: 30px;
}

.btn-primary:hover {
    background-color: #005BDD;
    transform: translateY(2px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
    background: #f8f9fa;
    color: #495057;
    border: 1px solid #dee2e6;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
}

.btn-secondary:hover {
    background: #e9ecef;
}

.btn-danger {
    background: #dc3545;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: background 0.2s ease;
}

.btn-danger:hover {
    background: #c82333;
}

.btn-download {
    background: #28a745;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    text-decoration: none;
    display: inline-block;
    transition: background 0.2s ease;
}

.btn-download:hover {
    background: #218838;
}

.files-list {
    display: grid;
    gap: 15px;
}

.file-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #667eea;
}

.file-info {
    display: flex;
    align-items: center;
    gap: 15px;
    flex: 1;
}

.file-icon {
    font-size: 2rem;
}

.file-details h3 {
    font-size: 1.1rem;
    color: #333;
    margin-bottom: 5px;
}

.file-meta {
    font-size: 0.9rem;
    color: #6c757d;
    display: flex;
    gap: 15px;
}

.file-actions {
    display: flex;
    gap: 10px;
}

.loading {
    text-align: center;
    padding: 40px;
    color: #6c757d;
    font-style: italic;
}

.toast {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 1000;
}

.toast.show {
    transform: translateX(0);
}

.toast.success {
    background: #28a745;
}

.toast.error {
    background: #dc3545;
}

@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
    
    header h1 {
        font-size: 2rem;
    }
    
    section {
        padding: 20px;
    }
    
    .file-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }
    
    .file-actions {
        width: 100%;
        justify-content: flex-end;
    }
    
    .section-header {
        flex-direction: column;
        gap: 15px;
        align-items: flex-start;
    }
}`, {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  // JS 파일 제공  
  if (pathname === '/script.js') {
    return new Response(`// API 엔드포인트
const API_BASE = '/api';

const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const filesList = document.getElementById('filesList');
const toast = document.getElementById('toast');

document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    refreshFileList();
});

function initializeEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
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
        const response = await fetch(API_BASE + '/upload', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            showToast(file.name + ' 업로드 완료! (' + current + '/' + total + ')', 'success');
        } else {
            const error = await response.text();
            showToast('업로드 실패: ' + error, 'error');
        }
    } catch (error) {
        showToast('업로드 에러: ' + error.message, 'error');
    }
    
    setTimeout(() => {
        uploadProgress.style.display = 'none';
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
    }, 1000);
}

async function refreshFileList() {
    filesList.innerHTML = '<div class="loading">파일 목록을 불러오는 중...</div>';
    
    try {
        const response = await fetch(API_BASE + '/files');
        const files = await response.json();
        
        if (files.length === 0) {
            filesList.innerHTML = '<div class="loading">업로드된 ISO 파일이 없습니다.</div>';
            return;
        }
        
        filesList.innerHTML = files.map(file => 
            '<div class="file-item">' +
                '<div class="file-info">' +
                    '<div class="file-icon">💿</div>' +
                    '<div class="file-details">' +
                        '<h3>' + file.name + '</h3>' +
                        '<div class="file-meta">' +
                            '<span>📏 ' + formatFileSize(file.size) + '</span>' +
                            '<span>📅 ' + formatDate(file.lastModified) + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="file-actions">' +
                    '<a href="' + API_BASE + '/download/' + encodeURIComponent(file.name) + '" class="btn-download" target="_blank">⬇️ 다운로드</a>' +
                    '<button class="btn-danger" onclick="deleteFile(\\'' + file.name + '\\')">🗑️ 삭제</button>' +
                '</div>' +
            '</div>'
        ).join('');
        
    } catch (error) {
        filesList.innerHTML = '<div class="loading">파일 목록을 불러오는데 실패했습니다.</div>';
        showToast('목록 로드 에러: ' + error.message, 'error');
    }
}

async function deleteFile(fileName) {
    if (!confirm('"' + fileName + '" 파일을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const response = await fetch(API_BASE + '/delete/' + encodeURIComponent(fileName), {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast(fileName + ' 삭제 완료!', 'success');
            refreshFileList();
        } else {
            const error = await response.text();
            showToast('삭제 실패: ' + error, 'error');
        }
    } catch (error) {
        showToast('삭제 에러: ' + error.message, 'error');
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

function showToast(message, type) {
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}`, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  return new Response('Not Found', { status: 404 });
} 