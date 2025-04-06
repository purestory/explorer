# WebDAV 파일 탐색기

Express.js와 WebDAV 서버를 기반으로 구현된 파일 탐색기 웹 애플리케이션입니다.

## 주요 기능

- 파일 및 폴더 관리 (업로드, 다운로드, 이동, 복사, 삭제)
- 긴 경로 및 한글 파일명 지원
- 드래그 앤 드롭 파일 업로드
- 폴더 잠금 기능
- 디스크 사용량 모니터링
- 파일 압축 기능

## 구조

- `backend/`: 서버 코드 (Express.js, WebDAV)
- `frontend/`: 클라이언트 코드 (HTML, CSS, JavaScript)
- `코드분석.md`: 프론트엔드 코드 분석 문서
- `백엔드_코드분석.md`: 백엔드 코드 분석 문서

## 기술 스택

- **백엔드**: Node.js, Express.js, webdav-server
- **프론트엔드**: HTML, CSS, JavaScript (바닐라)

## 설치 및 실행

1. 저장소 클론
   ```
   git clone https://github.com/purestory/webdav.git
   cd webdav
   ```

2. 백엔드 설치 및 실행
   ```
   cd backend
   npm install
   npm start
   ```

3. 브라우저에서 접속
   ```
   http://localhost:3333
   ```

## 특징

- 모놀리식 구조의 간단한 설계
- 상세한 로깅 시스템
- 복잡한 파일명 및 경로 처리 지원
- WebDAV 프로토콜 지원

## 기능

- 파일 및 폴더 탐색
- 파일 업로드/다운로드
- 폴더 생성
- 파일 및 폴더 이름 변경
- 파일 및 폴더 삭제
- 파일 압축 및 압축 해제
- 드래그 앤 드롭 기능
- 파일 검색
- 목록 보기 및 그리드 보기 지원
- 다중 파일 선택
- 키보드 단축키
- 다크 모드 지원

## 최근 업데이트

### 2023.05.30 - 드래그앤드롭 파일 업로드 개선
- 중복 업로드 방지 기능 추가
- 업로드 완료 상태 관리 개선
- 이벤트 처리 최적화
- 업로드 UI 처리 속도 향상
- 외부 파일 드래그앤드롭 감지 정확도 개선

### 2023.06.01 - 프로젝트 구조 개선
- 프로젝트를 frontend와 backend로 분리
- 코드 모듈화 개선
- 유지보수성 향상

## 기술 스택

- **프론트엔드**: HTML, CSS, JavaScript
- **백엔드**: Node.js, Express, WebDAV-Server
- **웹 서버**: Nginx
- **프로토콜**: WebDAV

## 프로젝트 구조

```
webdav-explorer/
├── frontend/             # 프론트엔드 코드
│   ├── index.html        # 메인 HTML 파일
│   ├── style.css         # 스타일시트
│   ├── script.js         # 프론트엔드 JavaScript
│   └── package.json      # 프론트엔드 의존성
│
├── backend/              # 백엔드 코드
│   ├── server.js         # 메인 서버 파일
│   ├── routes/           # API 라우트
│   ├── controllers/      # 컨트롤러
│   ├── middlewares/      # 미들웨어
│   ├── utils/            # 유틸리티 함수
│   ├── logs/             # 로그 파일
│   ├── share-folder/     # 공유 폴더
│   └── package.json      # 백엔드 의존성
│
├── package.json          # 프로젝트 메인 package.json
└── README.md             # 프로젝트 설명
```

## 설치 방법

1. 저장소 클론:
```
git clone https://github.com/purestory/webdav-explorer.git
```

2. 필요한 패키지 설치:
```
cd webdav-explorer
npm run install-all
```

3. 서버 시작:
```
npm start
```

4. 브라우저에서 접속:
```
http://localhost:3333
```

## 개발 모드 실행

백엔드 개발 모드:
```
npm run backend
```

프론트엔드 개발 모드:
```
npm run frontend
```

## 서비스 설정 (시스템 서비스 등록)

1. systemd 서비스 파일 생성:
```
sudo nano /etc/systemd/system/webdav.service
```

2. 다음 내용 작성:
```
[Unit]
Description=WebDAV Server
After=network.target

[Service]
ExecStart=/usr/bin/node /home/purestory/webdav/backend/server.js
Restart=always
User=purestory
Group=purestory
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=/home/purestory/webdav

[Install]
WantedBy=multi-user.target
```

3. 서비스 활성화 및 시작:
```
sudo systemctl enable webdav
sudo systemctl start webdav
```

## Nginx 연동 설정

```
server {
    listen 80;
    server_name itsmyzone.iptime.org;

    client_max_body_size 10000M;
    client_body_timeout 600s;
    
    charset utf-8;
    
    # 기본 페이지로 로컬 Node 서버 프록시
    location / {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        
        # CORS 설정
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
    }
    
    # WebDAV API 경로 프록시
    location /api/ {
        proxy_pass http://localhost:3333/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
    
    # WebDAV 서버 경로 프록시
    location /webdav/ {
        proxy_pass http://localhost:3333/webdav/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        
        # WebDAV 메서드 지원
        proxy_pass_request_headers on;
        proxy_set_header Destination $http_destination;
        proxy_set_header Overwrite $http_overwrite;
        
        # WebDAV 메서드 허용
        proxy_method $request_method;
        proxy_pass_request_body on;
    }
    
    # 정적 파일 서비스
    location /static/ {
        alias /home/purestory/webdav/frontend/;
        expires 1d;
        add_header Cache-Control "public";
    }
}
```

## 주요 설정

- **최대 업로드 크기**: 10GB
- **공유 폴더 위치**: /home/purestory/webdav/backend/share-folder
- **로그 파일 위치**: /home/purestory/webdav/backend/logs/

## 문제 해결

### share-folder 디렉토리 오류
서비스 시작 시 "share-folder 디렉토리를 찾을 수 없습니다" 오류가 발생할 경우 다음 명령어로 해결할 수 있습니다:
```
mkdir -p backend/share-folder && chmod 777 backend/share-folder
```

### 포트 사용 중 오류
서비스 시작 시 "EADDRINUSE: address already in use :::3333" 오류가 발생할 경우 다음 명령어로 해당 포트를 사용 중인 프로세스를 확인하고 종료할 수 있습니다:
```
sudo lsof -i:3333
sudo kill <PID>
```

### 드래그앤드롭 업로드 문제
파일을 드래그앤드롭으로 업로드할 때 발생할 수 있는 문제:
- 업로드 전송량이 흔들리는 현상은 v1.2.0 이상에서 해결됨
- 여러 파일을 동시에 드래그앤드롭할 때 웹페이지가 멈추는 현상은 v1.2.0 이상에서 해결됨
- 업로드 중 다른 파일을 드래그앤드롭하면 중복 업로드 방지 기능이 작동합니다

## 서비스 상태 확인

서비스 상태 확인:
```
systemctl status webdav
```

서비스 로그 확인:
```
journalctl -u webdav --since today
```

## 개발 정보

- **개발자**: purestory
- **GitHub**: https://github.com/purestory/webdav-explorer
- **라이선스**: MIT

## 주의사항

- 보안을 위해 접근 제어를 설정하는 것이 좋습니다.
- 대용량 파일 업로드 시 서버 성능에 영향을 줄 수 있습니다.
- 정기적인 백업을 권장합니다. 


##할일
삭제 비동기화

