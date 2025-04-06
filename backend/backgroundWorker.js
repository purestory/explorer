const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');

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

// --- SIGTERM 핸들러 추가 ---
process.on('SIGTERM', () => {
  log('SIGTERM 신호 수신. 워커 프로세스를 종료합니다.');
  // 필요한 경우, 진행 중인 작업을 정리하는 로직을 추가할 수 있지만,
  // 파일 시스템 작업은 안전하게 중단하기 어려우므로 즉시 종료합니다.
  process.exit(0); // 정상 종료 코드로 종료 (신호 수신은 정상적인 상황으로 간주)
});

// 메인 프로세스로부터 인자 받기 (0: node, 1: script path, 2: operation, 3: targetPath)
const operation = process.argv[2];
const targetPath = process.argv[3];

if (!operation || !targetPath) {
  errorLog('잘못된 인자입니다. operation과 targetPath가 필요합니다.', { argv: process.argv });
  process.exit(1); // 실패 종료
}

(async () => {
  let timeoutId = null; // 타임아웃 ID 저장 변수
  const TIMEOUT_DURATION = 600000; // 타임아웃 시간 (10분 = 600 * 1000 ms)

  try {
    // *** 타임아웃 설정 ***
    timeoutId = setTimeout(() => {
      errorLog(`작업 시간 초과 (${TIMEOUT_DURATION / 1000}초). 프로세스를 강제 종료합니다.`, { operation, targetPath });
      process.exit(1); // 타임아웃 시 실패 종료
    }, TIMEOUT_DURATION);

    log(`작업 시작: ${operation}, 대상: ${targetPath}`);

    if (operation === 'delete') {
      // await fs.rm(targetPath, { recursive: true, force: true }); // 기존 fs.rm 주석 처리
      // rm 명령어 실행 (-r: 재귀적으로, -f: 강제로)
      await new Promise((resolve, reject) => {
        const command = `rm -rf "${targetPath.replace(/"/g, '\"')}"`; // 경로에 따옴표가 있을 경우 이스케이프
        log(`명령어 실행: ${command}`);
        exec(command, (error, stdout, stderr) => {
          if (stdout) {
            log(`rm stdout: ${stdout.trim()}`);
          }
          if (stderr) {
            // stderr에 내용이 있어도 에러가 아닐 수 있음 (예: 진행 상황 메시지)
            // 하지만 rm 명령어는 보통 성공 시 출력이 없으므로, stderr 내용이 있다면 일단 경고로 기록
            log(`rm stderr: ${stderr.trim()}`);
          }
          if (error) {
            errorLog(`rm 명령어 실행 오류: ${targetPath}`, error);
            return reject(error); // Promise를 reject하여 오류 처리
          }
          resolve(); // 성공 시 Promise를 resolve
        });
      });
      log(`삭제 작업 완료 (rm 명령어 사용): ${targetPath}`);
    } else if (operation === 'create') {
      // recursive: true는 부모 디렉토리가 없어도 생성해줍니다.
      // mode: 0o777은 권한 설정입니다 (필요에 따라 조정).
      await fs.mkdir(targetPath, { recursive: true, mode: 0o777 });
      log(`생성 작업 완료: ${targetPath}`);
    } else {
      if (timeoutId) clearTimeout(timeoutId); // *** 지원되지 않는 작업 시 타임아웃 취소 ***
      errorLog('지원되지 않는 작업입니다.', { operation });
      process.exit(1);
    }

    if (timeoutId) clearTimeout(timeoutId); // *** 작업 성공 시 타임아웃 취소 ***
    process.exit(0); // 성공 종료

  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId); // *** 오류 발생 시 타임아웃 취소 ***
    errorLog(`${operation} 작업 중 오류 발생: ${targetPath}`, error);
    process.exit(1); // 실패 종료
  }
})(); 