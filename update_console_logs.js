const fs = require('fs');
const path = require('path');

// 수정할 파일 경로
const serverFilePath = path.join(__dirname, 'backend', 'server.js');

// 파일 읽기
console.log('원본 파일 읽는 중...');
let serverCode = fs.readFileSync(serverFilePath, 'utf8');

// 수정 전 백업 생성
const backupPath = path.join(__dirname, 'backend', 'server.js.bak');
fs.writeFileSync(backupPath, serverCode, 'utf8');
console.log(`백업 파일 생성됨: ${backupPath}`);

// 수정 패턴
console.log('콘솔 로그 제거 중...');

// 1. log 함수에서 console.log 제거
serverCode = serverCode.replace(
  /function log\(message\) \{([\s\S]*?)console\.log\(message\);([\s\S]*?)\}/,
  "function log(message) {$1// 콘솔 출력 제거됨$2}"
);

// 2. logWithIP 함수에서 console.log 제거
serverCode = serverCode.replace(
  /function logWithIP\(message, req\) \{([\s\S]*?)console\.log\(`\[IP: \$\{ip\}\] \$\{message\}`\);([\s\S]*?)\}/,
  "function logWithIP(message, req) {$1// 콘솔 출력 제거됨$2}"
);

// 3. 기타 다른 로깅 관련 미들웨어 수정
serverCode = serverCode.replace(
  /app\.use\(\(req, res, next\) => \{\s*log\(`\$\{req\.method\} \$\{req\.url\}`\);\s*next\(\);\s*\}\);/,
  "app.use((req, res, next) => {\n  // 콘솔 로깅 제거됨\n  next();\n});"
);

// 4. 서버 시작 로그 메시지 수정
serverCode = serverCode.replace(
  /app\.listen\(PORT, \(\) => \{\s*log\(`서버가 시작되었습니다\. http:\/\/localhost:\$\{PORT\}`\);\s*log\(`WebDAV 서버: http:\/\/localhost:\$\{PORT\}\/webdav`\);\s*\}\);/,
  "app.listen(PORT, () => {\n  log(`서버가 시작되었습니다. http://localhost:${PORT}`);\n  log(`WebDAV 서버: http://localhost:${PORT}/webdav`);\n  // 콘솔 출력 제거됨\n});"
);

// 5. 파일 쓰기
console.log('수정된 파일 저장 중...');
fs.writeFileSync(serverFilePath, serverCode, 'utf8');

console.log('완료! 서버를 재시작하세요.');

// 변경 내용 요약
console.log('\n변경 내용 요약:');
console.log('1. log 함수에서 console.log 제거');
console.log('2. logWithIP 함수에서 console.log 제거');
console.log('3. 로깅 미들웨어 비활성화');
console.log('4. 서버 시작 로그 메시지에서 콘솔 출력 제거');
console.log('\n서버 재시작 방법: sudo systemctl restart webdav'); 