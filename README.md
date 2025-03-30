# WebDAV 파일 서버

WebDAV(Web Distributed Authoring and Versioning) 프로토콜을 통해 파일을 공유하고 관리할 수 있는 웹 기반 파일 서버입니다.

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

## 기술 스택

- **프론트엔드**: HTML, CSS, JavaScript
- **백엔드**: Node.js
- **웹 서버**: Nginx
- **프로토콜**: WebDAV

## 설치 방법

1. 저장소 클론:
```
git clone https://github.com/purestory/webdav.git
```

2. 필요한 패키지 설치:
```
cd webdav
npm install
```

3. 서버 시작:
```
npm start
```

4. 브라우저에서 접속:
```
http://localhost:3333
```

## 서비스 설정 (시스템 서비스 등록)

1. systemd 서비스 파일 생성:
```
sudo nano /etc/systemd/system/webdav.service
```

2. 다음 내용 작성:
```
[Unit]
Description=WebDAV File Server
After=network.target

[Service]
User=purestory
WorkingDirectory=/home/purestory/webdav
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

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
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://localhost:3333/api/;
        proxy_http_version 1.1;
        client_max_body_size 1G;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 주요 설정

- **최대 업로드 크기**: 1GB
- **공유 폴더 위치**: /home/purestory/webdav/share-folder
- **로그 파일 위치**: /var/log/webdav/

## 개발 정보

- **개발자**: purestory
- **GitHub**: https://github.com/purestory/webdav
- **라이선스**: MIT

## 주의사항

- 보안을 위해 접근 제어를 설정하는 것이 좋습니다.
- 대용량 파일 업로드 시 서버 성능에 영향을 줄 수 있습니다.
- 정기적인 백업을 권장합니다. 