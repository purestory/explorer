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
      try {
        const stats = await fsPromises.stat(targetPath);
        if (stats.isDirectory()) {
          itemType = '폴더';
        } else if (stats.isFile()) {
          itemType = '파일';
        }
        log(`삭제 대상 타입 확인: ${itemType}`);
      } catch (statError) {
        if (statError.code === 'ENOENT') {
          log('삭제 대상이 이미 존재하지 않습니다.');
          // 대상이 없으면 성공으로 간주하고 종료할 수 있음
          if (timeoutId) clearTimeout(timeoutId);
          process.exit(0); // 성공 종료
          return; // 이후 삭제 로직 실행 방지
        } else {
          // 다른 stat 오류 (예: 권한 문제)
          errorLog(`대상 타입 확인 오류: ${targetPath}`, statError);
          // 오류 발생 시에도 삭제 시도
        }
      }

      // rm 명령어 실행
      await new Promise((resolve, reject) => {
        const command = `rm -rf "${targetPath.replace(/"/g, '\\"')}"`;
        log(`명령어 실행: ${command}`);
        exec(command, (error, stdout, stderr) => {
          if (stdout) {
            log(`rm stdout: ${stdout.trim()}`);
          }
          if (stderr) {
            log(`rm stderr: ${stderr.trim()}`);
          }
          if (error) {
            errorLog(`rm 명령어 실행 오류 (${itemType}): ${targetPath}`, error);
            return reject(error);
          }
          resolve(); 
        });
      });
      // 로그 메시지에 타입 포함
      log(`${itemType} 삭제 작업 완료 (rm 명령어 사용): ${targetPath}`);

    } else if (operation === 'create') {
      // recursive: true는 부모 디렉토리가 없어도 생성해줍니다.
      // mode: 0o777은 권한 설정입니다 (필요에 따라 조정).
      await fsPromises.mkdir(targetPath, { recursive: true, mode: 0o777 });
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