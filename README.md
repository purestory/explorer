# WebDAV 파일 서버 프로젝트

이 프로젝트는 Node.js와 Express를 기반으로 한 WebDAV 파일 서버 웹 애플리케이션입니다. 사용자 친화적인 웹 인터페이스를 통해 파일 시스템을 쉽게 관리할 수 있습니다.

![WebDAV 파일 서버 메인 화면](screenshot/main.png)

## 주요 기능

### 파일 관리
- 파일 및 폴더 탐색
- 파일 업로드 (드래그 앤 드롭 지원, 최대 10GB)
- 파일 다운로드
- 폴더 생성
- 파일/폴더 이름 변경
- 파일/폴더 삭제
- 잘라내기/붙여넣기 기능으로 파일 이동
- 대용량 파일 압축 기능 (500MB 이하 파일만 지원)

### 사용자 인터페이스
- 목록 보기와 그리드 보기 전환 가능
- 파일 및 폴더 다중 선택 (드래그 선택, Ctrl+클릭, Shift+클릭)
- 파일 이름, 크기, 날짜별 정렬
- 실시간 검색 기능
- 컨텍스트 메뉴 (우클릭 메뉴)
- 드래그 앤 드롭으로 파일 이동
- 디스크 사용량 표시

### 파일 업로드 및 다운로드
- 드래그 앤 드롭으로 간편한 업로드
- 대용량 파일 지원 (최대 10GB)
- 다중 파일 동시 업로드
- 업로드 진행률 표시 및 예상 시간 계산

### 시스템 기능
- WebDAV 프로토콜 지원
- 대용량 파일 업로드 지원
- 저장소 공간 관리
- 자세한 서버 로깅 시스템

## 기술 스택

### 프론트엔드
- HTML5, CSS3, JavaScript (바닐라)
- Font Awesome 5.15.4 (아이콘)
- 반응형 디자인

### 백엔드
- Node.js
- Express.js
- webdav-server (WebDAV 프로토콜 구현)
- multer (파일 업로드 처리)
- fs (파일 시스템 조작)

## 단축키

- `F2`: 선택한 항목 이름 변경
- `Delete`: 선택한 항목 삭제
- `Ctrl+A`: 모든 항목 선택
- `Ctrl+X`: 선택한 항목 잘라내기
- `Ctrl+V`: 클립보드 항목 붙여넣기
- `Escape`: 선택 취소 및 컨텍스트 메뉴 닫기

## 모바일 지원

모바일 환경에서도 최적화된 인터페이스를 제공합니다.

## 시스템 요구사항

- Node.js 14 이상
- 최신 웹 브라우저 (Chrome, Firefox, Safari, Edge)

## 설치 방법

```bash
# 저장소 클론
git clone https://github.com/purestory/webdav.git

# 디렉토리 이동
cd webdav

# 의존성 설치
npm install

# 서버 실행
node server.js
```

기본적으로 서버는 3333 포트에서 실행됩니다. 브라우저에서 http://localhost:3333 으로 접속하세요.

## 로그 시스템

- 서버 작동 로그: `/var/log/webdav/server.log`
- 오류 로그: `/var/log/webdav/error.log`

## 파일 구조

- `server.js`: 메인 서버 애플리케이션
- `index.html`: 웹 인터페이스
- `style.css`: 스타일시트
- `script.js`: 프론트엔드 로직
- `share-folder/`: 파일 저장소

## 라이선스

이 프로젝트는 오픈 소스로 제공됩니다. (MIT 라이선스)

## 제작자

purestory (GitHub: [https://github.com/purestory](https://github.com/purestory)) 