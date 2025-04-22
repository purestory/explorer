# Explorer 파일 탐색기

Express.js와 Explorer 서버를 기반으로 구현된 파일 탐색기 웹 애플리케이션입니다.

## 주요 기능

- 파일 및 폴더 관리 (업로드, 다운로드, 이동, 복사, 삭제)
- 긴 경로 및 한글 파일명 지원
- 드래그 앤 드롭 파일 업로드
- 폴더 잠금 기능
- 디스크 사용량 모니터링
- 파일 압축/압축해제 기능
- 세션 기반 인증 시스템
- 로그 레벨 조정 기능
- 비동기 파일 처리를 위한 백그라운드 워커

## 구조

- `backend/`: 서버 코드 (Express.js, Explorer, 세션 관리)
- `frontend/`: 클라이언트 코드 (HTML, CSS, JavaScript)
- `util/`: 유틸리티 스크립트 (로그 분석, 코드 수정 등)
- `config/`: 설정 파일
- `tmp/`: 임시 파일 디렉토리

## 기술 스택

- **백엔드**: Node.js, Express.js, Explorer-server
  - 주요 패키지: express-session, archiver, body-parser, multer, iconv-lite
- **프론트엔드**: HTML, CSS, JavaScript (바닐라)
  - FontAwesome 아이콘 사용
- **인프라**: Nginx, systemd

## 설치 및 실행

1. 저장소 클론
   ```
   git clone https://github.com/purestory/explorer.git
   cd explorer
   ```

2. 백엔드 설치 및 실행
   ```
   cd backend
   npm install
   npm start
   ```

3. 브라우저에서 접속
   ```
   http://itsmyzone.iptime.org:3333
   http://itsmyzone.iptime.org/explorer
   ```

## 보안 설정

프로젝트는 `.env` 파일을 통해 민감한 설정을 관리합니다:

```
# 환경 변수 설정 파일
# 실제 운영 시에는 이 파일의 접근 권한을 제한해야 합니다.

# 로그인 비밀번호
ACCESS_PASSWORD="your_secure_password"

# Express 세션 시크릿 
SESSION_SECRET="your_strong_random_session_secret_here"
```

## 로깅 시스템

프로젝트는 세 가지 로그 레벨을 지원합니다:
- `minimal`: 기본 운영 정보만 기록
- `info`: 상세한 작업 정보 기록
- `debug`: 개발자용 디버깅 정보 포함

로그 파일:
- `logs/server.log`: 일반 서버 로그
- `logs/error.log`: 오류 로그
- `logs/systemd.log`: systemd 서비스 로그
- `logs/systemd-error.log`: systemd 오류 로그
- `logs/nginx_error.log`: Nginx 오류 로그

로그 분석을 위한 유틸리티 스크립트:
```bash
bash util/get_log_tails.sh
```

## 프로젝트 구조

```
explorer/
├── .env                   # 환경 변수 설정
├── frontend/              # 프론트엔드 코드
│   ├── index.html         # 로그인 페이지
│   ├── main.html          # 메인 애플리케이션 페이지
│   ├── style.css          # 스타일시트
│   ├── script.js          # 메인 애플리케이션 스크립트
│   ├── upload.js          # 파일 업로드 관련 스크립트
│   ├── login.js           # 인증 관련 스크립트
│   └── mode_logger.js     # 로그 관련 스크립트
│
├── backend/               # 백엔드 코드
│   ├── server.js          # 메인 서버 파일
│   ├── backgroundWorker.js # 비동기 작업 처리용 워커
│   ├── lockedFolders.json # 잠긴 폴더 정보
│   ├── share-folder/      # 공유 폴더 (파일 저장소)
│   ├── logs/              # 로그 파일 디렉토리
│   └── tmp/               # 임시 파일 디렉토리
│
├── util/                  # 유틸리티 스크립트
│   ├── get_log_tails.sh   # 로그 파일 분석 스크립트
│   └── replace_code_block.py # 코드 블록 교체 유틸리티
│
└── README.md              # 프로젝트 설명
```

## 시스템 서비스 설정

### systemd 서비스 파일

파일 위치: `/etc/systemd/system/explorer.service`

```
[Unit]
Description=Explorer Server
After=network.target

[Service]
ExecStart=/usr/bin/node /home/purestory/explorer/backend/server.js
Restart=always
User=purestory
Group=purestory
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=/home/purestory/explorer

[Install]
WantedBy=multi-user.target
```

### Nginx 연동 설정

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
    
    # Explorer API 경로 프록시
    location /api/ {
        proxy_pass http://localhost:3333/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
    
    # Explorer 서버 경로 프록시
    location /explorer/ {
        proxy_pass http://localhost:3333/explorer/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        
        # Explorer 메서드 지원
        proxy_pass_request_headers on;
        proxy_set_header Destination $http_destination;
        proxy_set_header Overwrite $http_overwrite;
        
        # Explorer 메서드 허용
        proxy_method $request_method;
        proxy_pass_request_body on;
    }
    
    # 정적 파일 서비스
    location /static/ {
        alias /home/purestory/explorer/frontend/;
        expires 1d;
        add_header Cache-Control "public";
    }
}
```

## 주요 설정

- **포트**: 3333 (기본값)
- **최대 업로드 크기**: 10GB
- **공유 폴더 위치**: /home/purestory/explorer/backend/share-folder
- **로그 파일 위치**: /home/purestory/explorer/backend/logs/

## 문제 해결

### share-folder 디렉토리 오류
서비스 시작 시 "share-folder 디렉토리를 찾을 수 없습니다" 오류가 발생할 경우:
```
mkdir -p backend/share-folder && chmod 777 backend/share-folder
```

### 포트 사용 중 오류
"EADDRINUSE: address already in use :::3333" 오류 해결:
```
sudo lsof -i:3333
sudo kill <PID>
```

### 드래그앤드롭 업로드 문제
- 업로드 전송량이 흔들리는 현상은 v1.2.0 이상에서 해결됨
- 업로드 중 다른 파일을 드래그앤드롭하면 중복 업로드 방지 기능이 작동합니다
- 대용량 파일 업로드 시 서버 성능과 메모리 사용량 모니터링이 필요합니다

## 서비스 관리

서비스 상태 확인:
```
sudo systemctl status explorer
```

서비스 로그 확인:
```
sudo journalctl -u explorer --since today
```

서비스 시작/중지/재시작:
```
sudo systemctl start explorer
sudo systemctl stop explorer  
sudo systemctl restart explorer
```

## 향후 개발 계획

- 삭제 비동기화 구현
- 사용자 권한 관리 기능 개선
- 다중 사용자 지원 확장
- 모바일 인터페이스 최적화
- 파일 미리보기 기능 향상

## 개발 정보

- **개발자**: purestory
- **GitHub**: https://github.com/purestory/explorer
- **라이선스**: MIT

## 주의사항

- 보안을 위해 접근 제어를 설정하는 것이 좋습니다.
- 중요 데이터는 정기적으로 백업하세요.
- 서버 업데이트 시 항상 `/etc/nginx/sites-enabled/purestory` 설정을 함께 검토하세요.

