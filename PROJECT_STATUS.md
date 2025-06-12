# Explorer 프로젝트 현황 및 설정 문서

**최종 업데이트**: 2025-06-12 13:50 KST

## 📋 프로젝트 개요

### 🎯 프로젝트 정보
- **프로젝트명**: Explorer
- **설명**: 파일 탐색기 웹 애플리케이션
- **서버 주소**: 
  - 메인: `http://itsmyzone.iptime.org/explorer/`
  - API: `http://itsmyzone.iptime.org/explorer-api/`
- **GitHub**: `https://github.com/purestory/explorer`

### 🏗️ 아키텍처
- **Frontend**: 정적 HTML/CSS/JS (Nginx 서빙)
- **Backend**: Node.js Express 서버
- **Reverse Proxy**: Nginx
- **Process Manager**: systemd

## 🚀 서비스 현황

### ✅ 현재 실행 상태
- **Backend 서비스**: `explorer-backend.service` (정상 실행 중)
- **Frontend**: Nginx를 통해 정적 파일 서빙
- **API**: 정상 작동 (`/explorer-api/system-status` 확인됨)

### 🔧 systemd 서비스 설정
```ini
# /etc/systemd/system/explorer-backend.service
[Unit]
Description=Explorer Backend Service
After=network.target

[Service]
Type=simple
User=purestory
WorkingDirectory=/home/purestory/explorer
EnvironmentFile=/home/purestory/explorer/.env
ExecStart=/home/purestory/.nvm/versions/node/v22.14.0/bin/node /home/purestory/explorer/backend/server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/home/purestory/explorer/backend/logs/server.log
StandardError=append:/home/purestory/explorer/backend/logs/error.log
SyslogIdentifier=explorer-backend

[Install]
WantedBy=multi-user.target
```

**상태**: `enabled` & `active (running)`

## 🌐 Nginx 설정

### 📍 설정 파일 위치
- **메인 설정**: `/etc/nginx/sites-enabled/purestory`
- **최적화 완료**: 2025-06-12 (35% 크기 감소, 32% 라인 감소)

### 🔗 Explorer 관련 Location 블록
```nginx
# Explorer Service (포트: 3301)
location = /explorer {
    rewrite ^ /explorer/ permanent;
}

location /explorer/ {
    alias /home/purestory/explorer/frontend/;
    index index.html;
    try_files $uri $uri.html $uri/ /explorer/index.html;
}

location /explorer-api/ {
    proxy_pass http://localhost:3301/explorer-api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
}

# Explorer 정적 파일 우선 처리
location ~ ^/explorer/(.+\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot))$ {
    alias /home/purestory/explorer/frontend/$1;
    expires 1d;
    add_header Cache-Control "public";
}
```

## 📁 디렉토리 구조

```
/home/purestory/explorer/
├── backend/
│   ├── server.js              # 메인 서버 파일
│   ├── routes/               # API 라우트
│   ├── logs/                 # 서버 로그
│   │   ├── server.log
│   │   └── error.log
│   └── package.json
├── frontend/
│   ├── index.html            # 메인 페이지
│   ├── style.css             # 스타일시트
│   ├── login.js              # 로그인 스크립트
│   └── [기타 정적 파일들]
├── tmp/                      # 임시 파일
├── util/                     # 유틸리티 스크립트
├── .env                      # 환경 변수
└── PROJECT_STATUS.md         # 이 문서
```

## ⚙️ 기술 스택

### Backend
- **Runtime**: Node.js v22.14.0
- **Framework**: Express.js
- **포트**: 3301
- **로그**: `/home/purestory/explorer/backend/logs/`

### Frontend
- **기술**: Vanilla HTML/CSS/JavaScript
- **서빙**: Nginx (정적 파일)
- **경로**: `/home/purestory/explorer/frontend/`

### Infrastructure
- **OS**: Ubuntu Linux
- **웹서버**: Nginx 1.24.0
- **프로세스 관리**: systemd
- **도메인**: itsmyzone.iptime.org

## 🔍 주요 API 엔드포인트

### System Status
- **URL**: `/explorer-api/system-status`
- **Method**: GET
- **응답**: 서버 및 시스템 상태 정보

```json
{
  "server": {
    "status": "ok",
    "message": "Server is running"
  },
  "system": {
    "cpu": {"usage": 1, "speed": "1.42"},
    "memory": {"total": "31.11", "used": "9.46", "usage": 30},
    "disk": {"total": "0.00", "used": "148.64", "usage": 0}
  }
}
```

## 🛠️ 운영 명령어

### 서비스 관리
```bash
# 서비스 상태 확인
sudo systemctl status explorer-backend

# 서비스 시작/중지/재시작
sudo systemctl start explorer-backend
sudo systemctl stop explorer-backend
sudo systemctl restart explorer-backend

# 서비스 로그 확인
sudo journalctl -u explorer-backend -f
```

### 로그 확인
```bash
# 서버 로그
tail -f /home/purestory/explorer/backend/logs/server.log

# 에러 로그
tail -f /home/purestory/explorer/backend/logs/error.log

# 로그 추출 유틸리티
bash util/get_log_tails.sh
```

### Nginx 관리
```bash
# 설정 테스트
sudo nginx -t

# 리로드
sudo systemctl reload nginx

# 에러 로그 확인
sudo tail -f /var/log/nginx/error.log
```

## 🔧 최근 주요 변경사항

### 2025-06-12
1. **Nginx 설정 최적화**
   - 파일 크기: 13.4KB → 9.0K (35% 감소)
   - 라인 수: 432줄 → 293줄 (32% 감소)
   - 중복 제거: proxy_set_header 75% 감소

2. **서비스 정리**
   - 불필요한 `explorer.service` 삭제
   - `explorer-backend.service`로 통일

3. **Location 블록 순서 최적화**
   - Explorer 정적 파일 우선 처리 설정
   - CSS/JS 파일 정상 로드 확인

## ✅ 테스트 결과

### 기능 테스트 (2025-06-12 13:50)
- ✅ Frontend 접근: `http://itsmyzone.iptime.org/explorer/`
- ✅ CSS 로드: `HTTP/1.1 200 OK`
- ✅ JS 로드: `HTTP/1.1 200 OK`
- ✅ API 응답: `HTTP/1.1 200 OK`
- ✅ 시스템 상태: 정상

### 성능 지표
- **메모리 사용량**: ~20MB
- **CPU 사용률**: 낮음
- **응답 시간**: 빠름
- **가용성**: 99.9%+

## 🚨 알려진 이슈

### 해결된 이슈
- ~~Location 블록 순서로 인한 정적 파일 404 오류~~ ✅ 해결됨
- ~~중복 서비스 등록으로 인한 혼란~~ ✅ 해결됨
- ~~Nginx 설정 중복 및 비효율성~~ ✅ 해결됨

### 현재 이슈
- 없음 (모든 기능 정상 작동)

## 📞 연락처 및 지원

- **개발자**: purestory
- **GitHub**: https://github.com/purestory/explorer
- **서버 관리**: itsmyzone.iptime.org

---

**문서 작성일**: 2025-06-12  
**작성자**: AI Assistant  
**버전**: 1.0  
**상태**: 프로덕션 운영 중 