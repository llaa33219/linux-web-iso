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
    return await getStaticFile('index.html');
  }

  // CSS, JS 파일 제공
  if (pathname === '/style.css' || pathname === '/script.js') {
    return await getStaticFile(pathname.substring(1));
  }

  return new Response('Not Found', { status: 404 });
}

// 정적 파일 내용 반환 (실제 배포시에는 파일을 읽어와야 함)
async function getStaticFile(filename) {
  // 주의: 실제 Cloudflare Pages 배포시에는 이 부분이 자동으로 처리됩니다.
  // 여기서는 Workers만 사용하는 경우를 위한 기본 응답입니다.
  
  const contentTypes = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8'
  };

  const extension = filename.split('.').pop();
  const contentType = contentTypes[extension] || 'text/plain';

  return new Response(`<!-- ${filename} 파일을 여기에 배치하세요 -->`, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    }
  });
} 