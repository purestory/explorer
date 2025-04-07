const fsPromises = require('fs/promises');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 로그 파일 경로 정의 (server.js와 동일하게)
const LOGS_DIRECTORY = path.join(__dirname, 'logs');
const SERVER_LOG_PATH = path.join(LOGS_DIRECTORY, 'server.log');
const ERROR_LOG_PATH = path.join(LOGS_DIRECTORY, 'error.log');

// 로그 함수 수정: 파일에만 기록
function log(message) {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const timestamp = kstDate.toISOString().replace('T', ' ').substring(0, 19) + ' KST';
  const logMessage = `${timestamp} - [WORKER] ${message}\n`;
  
  // console.log(`${timestamp} - [WORKER] ${message}`); // 콘솔 출력 제거
  try {
    if (!fs.existsSync(LOGS_DIRECTORY)) {
      fs.mkdirSync(LOGS_DIRECTORY, { recursive: true });
    }
    fs.appendFileSync(SERVER_LOG_PATH, logMessage); 
  } catch (err) {
    // 파일 쓰기 실패 시 콘솔 에러는 유지 (중요 오류 알림 목적)
    console.error('[WORKER] 로그 파일 쓰기 오류:', err);
  }
}

// 에러 로그 함수 수정: 파일에만 기록
function errorLog(message, error) {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const timestamp = kstDate.toISOString().replace('T', ' ').substring(0, 19) + ' KST';
  const errorMessage = `${timestamp} - [WORKER] ERROR: ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;
  
  // console.error(`${timestamp} - [WORKER] ERROR: ${message}`, error); // 콘솔 출력 제거
  try {
    if (!fs.existsSync(LOGS_DIRECTORY)) {
      fs.mkdirSync(LOGS_DIRECTORY, { recursive: true });
    }
    fs.appendFileSync(ERROR_LOG_PATH, errorMessage); 
  } catch (err) {
    // 파일 쓰기 실패 시 콘솔 에러는 유지
    console.error('[WORKER] 에러 로그 파일 쓰기 오류:', err);
  }
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
      let itemType = '항목'; // 기본값 설정
      // 타입 확인: 파일인지 폴더인지 (통계 목적)
      try {
        const stat = await fsPromises.stat(targetPath);
        itemType = stat.isDirectory() ? '폴더' : '파일';
        log(`삭제 대상 타입 확인: ${itemType}`);
      } catch (statError) {
        if (statError.code === 'ENOENT') {
          log(`삭제 대상이 이미 존재하지 않음: ${targetPath}`);
          if (timeoutId) clearTimeout(timeoutId);
          process.exit(0); // 이미 없으면 성공으로 간주
        } else {
          errorLog(`대상 타입 확인 오류: ${targetPath}`, statError);
          // 오류 발생 시에도 삭제 시도
        }
      }

      // rm 명령어 실행 (백틱과 같은 특수문자를 올바르게 이스케이프)
      const escapedPath = escapeShellArg(targetPath);
      const command = `rm -rf ${escapedPath}`;
      log(`명령어 실행: ${command}`);
      
      await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (stdout) {
            log(`rm stdout: ${stdout.trim()}`);
          }
          if (stderr) {
            log(`rm stderr: ${stderr.trim()}`);
            // stderr 자체는 오류로 처리하지 않고 로그만 기록
          }
          if (error) {
            errorLog(`rm 명령어 실행 오류 (${itemType}): ${targetPath}`, error);
            return reject(error);
          }
          resolve();
        });
      });
      
      log(`${itemType} 삭제 작업 완료 (rm 명령어 사용): ${targetPath}`);

    } else if (operation === 'create') {
      // 특수문자를 완벽하게 이스케이프하는 함수는 위에서 정의됨
      function escapeShellArg(arg) {
        // 모든 특수문자를 처리하기 위해 작은따옴표로 감싸고
        // 내부의 작은따옴표, 백틱, 달러 기호 등을 이스케이프
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }

      // mkdir 명령어 실행 (-p: 상위 디렉토리 자동 생성, -m 777: 권한 설정)
      const escapedPath = escapeShellArg(targetPath);
      const command = `mkdir -p -m 777 ${escapedPath}`;
      log(`명령어 실행: ${command}`);
      
      await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (stdout) {
            log(`mkdir stdout: ${stdout.trim()}`);
          }
          if (stderr) {
            log(`mkdir stderr: ${stderr.trim()}`);
            // stderr 자체는 오류로 처리하지 않고 로그만 기록
          }
          if (error) {
            errorLog(`mkdir 명령어 실행 오류: ${targetPath}`, error);
            return reject(error);
          }
          resolve();
        });
      });
      
      log(`폴더 생성 작업 완료 (mkdir 명령어 사용): ${targetPath}`);
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