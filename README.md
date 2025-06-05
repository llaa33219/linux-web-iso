# 🐧 Linux ISO 관리자

Cloudflare Pages와 Workers를 사용하여 R2 버킷의 ISO 파일을 관리하는 웹 애플리케이션입니다.

## ✨ 주요 기능

- 📤 **드래그 앤 드롭 업로드**: ISO 파일을 쉽게 업로드
- 📋 **파일 목록**: 업로드된 모든 ISO 파일 조회
- ⬇️ **다운로드**: 원클릭 파일 다운로드
- 🗑️ **삭제**: 불필요한 파일 삭제
- 📱 **반응형 디자인**: 모바일 친화적 인터페이스
- ⚡ **고성능**: Cloudflare의 글로벌 네트워크 활용

## 🚀 배포 방법

### 1. 전제 조건

- Cloudflare 계정
- `wrangler` CLI 설치
- `linux-iso` 이름의 R2 버킷 생성

### 2. 프로젝트 설정

```bash
# wrangler CLI 설치 (없는 경우)
npm install -g wrangler

# Cloudflare 로그인
wrangler auth login

# 의존성 설치
npm install
```

### 3. R2 버킷 생성

```bash
# R2 버킷 생성
wrangler r2 bucket create linux-iso
```

### 4. Cloudflare Pages 프로젝트 생성

Cloudflare Dashboard에서:
1. Pages 섹션으로 이동
2. "Create a project" 클릭
3. "Upload assets" 선택
4. 프로젝트 이름 설정: `linux-iso-manager`

### 5. R2 바인딩 설정

Cloudflare Dashboard의 Pages 프로젝트 설정에서:
1. Settings > Functions 탭
2. R2 bucket bindings 섹션
3. 변수명: `ISO_BUCKET`
4. R2 버킷: `linux-iso`

### 6. 배포

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 배포
npm run deploy
```

## 🔧 설정 정보

### R2 버킷 바인딩 변수명
- **변수명**: `ISO_BUCKET`
- **버킷명**: `linux-iso`

이 변수명을 Cloudflare Pages 설정에서 R2 바인딩 설정 시 사용하세요.

### 환경 설정

`wrangler.toml` 파일에서 다음 설정을 확인하세요:

```toml
[[r2_buckets]]
binding = "ISO_BUCKET"  # 👈 이 변수명 사용
bucket_name = "linux-iso"
```

## 📁 프로젝트 구조

```
├── index.html          # 메인 HTML 페이지
├── style.css           # 스타일시트
├── script.js           # 프론트엔드 JavaScript
├── _worker.js          # Cloudflare Workers 코드
├── wrangler.toml       # Workers 설정
├── package.json        # 프로젝트 설정
└── README.md           # 이 파일
```

## 🔐 보안 고려사항

- 파일 크기 제한: 10GB
- ISO 파일만 업로드 허용
- CORS 헤더 적절히 설정
- 파일 타입 검증

## 🛠️ 개발

로컬 개발 환경:

```bash
# 개발 서버 시작
npm run dev

# 로그 확인
npm run tail
```

## 📝 라이센스

MIT License

## �� 기여

이슈나 PR을 환영합니다! 