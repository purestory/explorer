const fs = require('fs/promises');
const path = require('path');

// 로그 함수 (server.js의 것을 단순화하여 사용)
function log(message) {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const timestamp = kstDate.toISOString().replace('T', ' ').substring(0, 19) + ' KST';
  console.log(`${timestamp} - [WORKER] ${message}`);
}

function errorLog(message, error) {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const timestamp = kstDate.toISOString().replace('T', ' ').substring(0, 19) + ' KST';
  console.error(`${timestamp} - [WORKER] ERROR: ${message}`, error);
  // 필요하다면 별도 로그 파일에 기록할 수도 있습니다.
}

// 메인 프로세스로부터 인자 받기 (0: node, 1: script path, 2: operation, 3: targetPath)
const operation = process.argv[2];
const targetPath = process.argv[3];

if (!operation || !targetPath) {
  errorLog('잘못된 인자입니다. operation과 targetPath가 필요합니다.', { argv: process.argv });
  process.exit(1); // 실패 종료
}

log(`작업 시작: ${operation}, 대상: ${targetPath}`);

(async () => {
  try {
    if (operation === 'delete') {
      await fs.rm(targetPath, { recursive: true, force: true });
      log(`삭제 작업 완료: ${targetPath}`);
    } else if (operation === 'create') {
      // recursive: true는 부모 디렉토리가 없어도 생성해줍니다.
      // mode: 0o777은 권한 설정입니다 (필요에 따라 조정).
      await fs.mkdir(targetPath, { recursive: true, mode: 0o777 });
      log(`생성 작업 완료: ${targetPath}`);
    } else {
      errorLog('지원되지 않는 작업입니다.', { operation });
      process.exit(1);
    }
    process.exit(0); // 성공 종료
  } catch (error) {
    errorLog(`${operation} 작업 중 오류 발생: ${targetPath}`, error);
    process.exit(1); // 실패 종료
  }
})(); 