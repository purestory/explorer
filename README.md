# 🗂️ Explorer - 웹 기반 파일 탐색기

[![GitHub Repository](https://img.shields.io/badge/GitHub-purestory%2Fexplorer-blue)](https://github.com/purestory/explorer)
[![Demo](https://img.shields.io/badge/Demo-Live%20Site-green)](http://itsmyzone.iptime.org/explorer/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 프로젝트 소개

**Explorer**는 현대적이고 직관적인 웹 기반 파일 탐색기입니다. 웹 브라우저를 통해 서버의 파일 시스템을 안전하고 편리하게 관리할 수 있습니다.

### ✨ 주요 기능

- 📁 **파일 & 폴더 관리**: 생성, 삭제, 이름 변경, 이동
- ⬆️ **파일 업로드**: 드래그 앤 드롭, 다중 파일, 폴더 업로드 지원
- ⬇️ **파일 다운로드**: 단일/다중 파일 다운로드, ZIP 압축 다운로드
- 🗜️ **압축 기능**: 선택한 파일/폴더를 ZIP으로 압축
- 🔒 **폴더 잠금**: 패스워드로 폴더 보호
- 🎨 **다양한 뷰**: 리스트 뷰, 그리드 뷰 지원
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 최적화
- 🚀 **실시간 업로드**: 진행률 표시, 중지/재개 기능

## 🌐 라이브 데모

**🔗 [http://itsmyzone.iptime.org/explorer/](http://itsmyzone.iptime.org/explorer/)**

## 🏗️ 아키텍처

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │    Nginx    │    │   Backend   │
│ HTML/CSS/JS │◄──►│ Proxy/Static│◄──►│  Node.js    │
│             │    │   Server    │    │  Express    │
└─────────────┘    └─────────────┘    └─────────────┘
```

### 🛠️ 기술 스택

**Frontend**
- HTML5, CSS3, JavaScript (ES6+)
- FontAwesome 아이콘
- 반응형 웹 디자인
- 드래그 앤 드롭 API

**Backend**
- Node.js v22.14.0
- Express.js 웹 프레임워크
- Multer (파일 업로드)
- Archiver (ZIP 압축)
- 세션 관리

**Infrastructure**
- Nginx (리버스 프록시 + 정적 파일 서빙)
- Ubuntu Linux
- systemd (프로세스 관리)

## 🚀 설치 및 실행

### 📋 요구사항

- Node.js 18.0.0 이상
- npm 또는 yarn
- Nginx (선택사항)

### 🔧 설치

1. **저장소 클론**
```bash
git clone https://github.com/purestory/explorer.git
cd explorer
```

2. **백엔드 의존성 설치**
```bash
cd backend
npm install
```

3. **환경 변수 설정**
```bash
cp .env.example .env
# .env 파일을 편집하여 설정 값 수정
```

4. **서버 실행**
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

### ⚙️ 설정

#### 환경 변수 (.env)
```env
PORT=3301
SESSION_SECRET=your_session_secret_here
ROOT_DIRECTORY=./share-folder
LOG_LEVEL=info
```

#### Nginx 설정 (선택사항)
```nginx
location /explorer/ {
    alias /path/to/explorer/frontend/;
    index index.html;
    try_files $uri $uri/ /explorer/index.html;
}

location /explorer-api/ {
    proxy_pass http://localhost:3301/explorer-api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50G;
}
```

## 📁 프로젝트 구조

```
explorer/
├── backend/                 # 백엔드 서버
│   ├── server.js           # 메인 서버 파일
│   ├── backgroundWorker.js # 백그라운드 작업 처리
│   ├── logs/              # 서버 로그
│   ├── share-folder/      # 파일 저장소 (기본)
│   ├── tmp/              # 임시 파일
│   └── package.json      # 의존성 정보
├── frontend/               # 프론트엔드
│   ├── index.html        # 메인 페이지
│   ├── main.html         # 파일 관리 페이지
│   ├── login.js          # 로그인 로직
│   ├── script.js         # 메인 스크립트
│   ├── upload.js         # 업로드 로직
│   ├── style.css         # 스타일시트
│   └── fontawesome/      # 아이콘 폰트
├── util/                 # 유틸리티 스크립트
├── config/              # 설정 파일
└── docs/               # 문서
```

## 🎮 사용법

### 기본 조작

1. **파일 업로드**: 파일을 드래그하여 브라우저에 드롭
2. **폴더 생성**: 상단 툴바의 "새 폴더" 버튼 클릭
3. **파일 선택**: 클릭으로 단일 선택, Ctrl+클릭으로 다중 선택
4. **파일 다운로드**: 파일 더블클릭 또는 다운로드 버튼
5. **압축 다운로드**: 여러 파일 선택 후 다운로드 버튼

### 고급 기능

- **폴더 잠금**: 우클릭 메뉴에서 "폴더 잠그기" 선택
- **잘라내기/붙여넣기**: Ctrl+X, Ctrl+V로 파일 이동
- **검색**: 상단 검색창에서 파일명으로 검색
- **정렬**: 컬럼 헤더 클릭으로 정렬 기준 변경

## 🔒 보안

- 세션 기반 인증
- 폴더별 패스워드 보호
- 파일 업로드 크기 제한
- XSS 및 CSRF 보호
- 경로 탐색 공격 방지

## 🤝 기여하기

기여를 환영합니다! 다음 단계를 따라주세요:

1. 이 저장소를 포크합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/AmazingFeature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/AmazingFeature`)
5. Pull Request를 생성합니다

### 🐛 버그 리포트

버그를 발견하셨나요? [Issues](https://github.com/purestory/explorer/issues)에서 다음 정보와 함께 리포트해주세요:

- 운영체제 및 브라우저 버전
- 재현 단계
- 예상 동작 vs 실제 동작
- 스크린샷 (가능한 경우)

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 👨‍💻 개발자

**purestory**
- GitHub: [@purestory](https://github.com/purestory)
- 프로젝트 링크: [https://github.com/purestory/explorer](https://github.com/purestory/explorer)

## 🙏 감사의 말

- [FontAwesome](https://fontawesome.com/) - 아이콘 제공
- [Express.js](https://expressjs.com/) - 웹 프레임워크
- [Nginx](https://nginx.org/) - 웹 서버

---

⭐ 이 프로젝트가 유용하다면 GitHub에서 Star를 눌러주세요! 