const fsPromises = require('fs/promises');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 특수문자를 완벽하게 이스케이프하는 함수 (전역 정의)
function escapeShellArg(arg) {
  // 모든 특수문자를 처리하기 위해 작은따옴표로 감싸고
  // 내부의 작은따옴표, 백틱, 달러 기호 등을 이스케이프
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

// 로그 파일 경로 정의 (server.js와 동일하게)
const LOGS_DIRECTORY = path.join(__dirname, 'logs');
const SERVER_LOG_PATH = path.join(LOGS_DIRECTORY, 'server.log');
const ERROR_LOG_PATH = path.join(LOGS_DIRECTORY, 'error.log');

// === 로그 레벨 정의 (server.js와 동일하게) ===
const LOG_LEVELS = { minimal: 0, info: 1, debug: 2 };
// === 환경 변수에서 현재 로그 레벨 가져오기 (기본값: info) ===
const currentLogLevel = LOG_LEVELS[process.env.CURRENT_LOG_LEVEL] !== undefined 
                        ? LOG_LEVELS[process.env.CURRENT_LOG_LEVEL] 
                        : LOG_LEVELS.info; 

// === 로그 함수 수정: 레벨 기능 추가 ===
function log(message, levelName = 'debug') { // 기본 레벨을 debug로 설정
  const level = LOG_LEVELS[levelName] !== undefined ? LOG_LEVELS[levelName] : LOG_LEVELS.debug;
  // === 레벨 비교 로직 추가 ===
  if (level > currentLogLevel) return; 

  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const timestamp = kstDate.toISOString().replace('T', ' ').substring(0, 19) + ' KST';
  const logMessage = `${timestamp} - [WORKER][${levelName.toUpperCase()}] ${message}\n`; // 레벨 태그 추가
  
  try {
    if (!fs.existsSync(LOGS_DIRECTORY)) {
      fs.mkdirSync(LOGS_DIRECTORY, { recursive: true });
    }
    fs.appendFileSync(SERVER_LOG_PATH, logMessage); 
  } catch (err) {
    console.error('[WORKER] 로그 파일 쓰기 오류:', err);
  }
}

// 에러 로그 함수 수정: 파일에만 기록 (레벨과 무관하게 항상 기록)
function errorLog(message, error) {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const timestamp = kstDate.toISOString().replace('T', ' ').substring(0, 19) + ' KST';
  const errorMessage = `${timestamp} - [WORKER] ERROR: ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;
  
  try {
    if (!fs.existsSync(LOGS_DIRECTORY)) {
      fs.mkdirSync(LOGS_DIRECTORY, { recursive: true });
    }
    fs.appendFileSync(ERROR_LOG_PATH, errorMessage); 
  } catch (err) {
    console.error('[WORKER] 에러 로그 파일 쓰기 오류:', err);
  }
}

// --- SIGTERM 핸들러 추가 ---
process.on('SIGTERM', () => {
  log('SIGTERM 신호 수신. 워커 프로세스를 종료합니다.', 'info'); // 레벨 변경: minimal -> info
  process.exit(0); 
});

// 메인 프로세스로부터 인자 받기 (0: node, 1: script path, 2: operation, 3: targetPath)
const operation = process.argv[2];
const targetPath = process.argv[3];

if (!operation || !targetPath) {
  errorLog('잘못된 인자입니다. operation과 targetPath가 필요합니다.', { argv: process.argv });
  process.exit(1); 
}

(async () => {
  let timeoutId = null; 
  const TIMEOUT_DURATION = 600000; 

  try {
    timeoutId = setTimeout(() => {
      errorLog(`작업 시간 초과 (${TIMEOUT_DURATION / 1000}초). 프로세스를 강제 종료합니다.`, { operation, targetPath });
      process.exit(1); 
    }, TIMEOUT_DURATION);

    log(`작업 시작: ${operation}, 대상: ${targetPath}`, 'info'); // info 레벨

    if (operation === 'delete') {
      let itemType = '항목'; 
      try {
        const stat = await fsPromises.stat(targetPath);
        itemType = stat.isDirectory() ? '폴더' : '파일';
        log(`삭제 대상 타입 확인: ${itemType}`, 'debug'); // debug 레벨
      } catch (statError) {
        if (statError.code === 'ENOENT') {
          log(`삭제 대상이 이미 존재하지 않음: ${targetPath}`, 'info'); // info 레벨
          if (timeoutId) clearTimeout(timeoutId);
          process.exit(0); 
        } else {
          errorLog(`대상 타입 확인 오류: ${targetPath}`, statError);
        }
      }

      // 임시 폴더 경로 설정 (수정된 부분 - 절대 경로 사용)
      const tmpDir = '/home/purestory/webdav/backend/tmp';
      
      log(`실제 임시 폴더 경로: ${tmpDir}`, 'info'); // 경로 로깅 추가
      
      // 임시 폴더 생성 (없는 경우)
      try {
        await new Promise((resolve, reject) => {
          const mkTmpCommand = `mkdir -p -m 777 ${escapeShellArg(tmpDir)}`;
          log(`임시 폴더 생성 명령어 실행: ${mkTmpCommand}`, 'debug');
          
          exec(mkTmpCommand, (error, stdout, stderr) => {
            if (error) {
              errorLog(`임시 폴더 생성 오류: ${tmpDir}`, error);
              return reject(error);
            }
            if (stderr) {
              log(`임시 폴더 생성 stderr: ${stderr.trim()}`, 'debug');
            }
            resolve();
          });
        });
      } catch (mkdirError) {
        errorLog(`임시 폴더 생성 실패: ${tmpDir}`, mkdirError);
        // 임시 폴더 생성 실패해도 계속 진행 (직접 삭제)
      }

      // 타임스탬프를 포함한 고유한 임시 하위 폴더 생성
      const timestamp = Date.now();
      const timestamp_folder = `${timestamp}_delete_tmp`;
      const tmpFolderPath = path.join(tmpDir, timestamp_folder);
      
      // 원본 파일/폴더 이름 그대로 유지
      const basename = path.basename(targetPath);
      const tmpTargetPath = path.join(tmpFolderPath, basename);
      
      // 임시 하위 폴더 생성
      try {
        await new Promise((resolve, reject) => {
          const mkTmpFolderCommand = `mkdir -p -m 777 ${escapeShellArg(tmpFolderPath)}`;
          log(`임시 하위 폴더 생성 명령어 실행: ${mkTmpFolderCommand}`, 'debug');
          
          exec(mkTmpFolderCommand, (error, stdout, stderr) => {
            if (error) {
              errorLog(`임시 하위 폴더 생성 오류: ${tmpFolderPath}`, error);
              return reject(error);
            }
            if (stderr) {
              log(`임시 하위 폴더 생성 stderr: ${stderr.trim()}`, 'debug');
            }
            resolve();
          });
        });
      } catch (mkdirError) {
        errorLog(`임시 하위 폴더 생성 실패: ${tmpFolderPath}`, mkdirError);
        // 임시 폴더 생성 실패해도 계속 진행 (직접 삭제)
      }
      
      // 1. 삭제 대상을 임시 폴더 내의 하위 폴더로 이동 (원본 이름 유지)
      try {
        log(`삭제 대상을 임시 폴더로 이동 시작: ${targetPath} -> ${tmpTargetPath}`, 'info');
        
        await new Promise((resolve, reject) => {
          const mvCommand = `mv ${escapeShellArg(targetPath)} ${escapeShellArg(tmpTargetPath)}`;
          log(`이동 명령어 실행: ${mvCommand}`, 'debug');
          
          exec(mvCommand, (error, stdout, stderr) => {
            if (stdout) {
              log(`mv stdout: ${stdout.trim()}`, 'debug');
            }
            if (stderr) {
              log(`mv stderr: ${stderr.trim()}`, 'debug');
            }
            if (error) {
              errorLog(`이동 명령어 실행 오류 (${itemType}): ${targetPath} -> ${tmpTargetPath}`, error);
              return reject(error);
            }
            resolve();
          });
        });
        
        log(`삭제 대상 이동 완료: ${targetPath} -> ${tmpTargetPath}`, 'info');
        
        // 2. 임시 폴더에 있는 대상 삭제
        const escapedTmpPath = escapeShellArg(tmpTargetPath);
        const rmCommand = `rm -rf ${escapedTmpPath}`;
        log(`임시 폴더에서 삭제 명령어 실행: ${rmCommand}`, 'debug');
        
        await new Promise((resolve, reject) => {
          exec(rmCommand, (error, stdout, stderr) => {
            if (stdout) {
              log(`rm stdout: ${stdout.trim()}`, 'debug');
            }
            if (stderr) {
              log(`rm stderr: ${stderr.trim()}`, 'debug');
            }
            if (error) {
              errorLog(`임시 폴더에서 삭제 명령어 실행 오류 (${itemType}): ${tmpTargetPath}`, error);
              return reject(error);
            }
            resolve();
          });
        });
        
        log(`임시 폴더에서 ${itemType} 삭제 완료: ${tmpTargetPath}`, 'info');
        
      } catch (moveError) {
        // 이동 실패 시 원래 위치에서 직접 삭제 (기존 로직)
        errorLog(`임시 폴더로 이동 실패, 직접 삭제 시도: ${targetPath}`, moveError);
        
        const escapedPath = escapeShellArg(targetPath);
        const rmCommand = `rm -rf ${escapedPath}`;
        log(`원래 위치에서 직접 삭제 명령어 실행: ${rmCommand}`, 'debug');
        
        await new Promise((resolve, reject) => {
          exec(rmCommand, (error, stdout, stderr) => {
            if (stdout) {
              log(`rm stdout: ${stdout.trim()}`, 'debug');
            }
            if (stderr) {
              log(`rm stderr: ${stderr.trim()}`, 'debug');
            }
            if (error) {
              errorLog(`원래 위치에서 삭제 명령어 실행 오류 (${itemType}): ${targetPath}`, error);
              return reject(error);
            }
            resolve();
          });
        });
        
        log(`원래 위치에서 ${itemType} 직접 삭제 완료: ${targetPath}`, 'info');
      }

    } else if (operation === 'create') {
      const escapedPath = escapeShellArg(targetPath);
      const command = `mkdir -p -m 777 ${escapedPath}`;
      log(`명령어 실행: ${command}`, 'debug'); // debug 레벨
      
      await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (stdout) {
            log(`mkdir stdout: ${stdout.trim()}`, 'debug'); // debug 레벨
          }
          if (stderr) {
            log(`mkdir stderr: ${stderr.trim()}`, 'debug'); // debug 레벨
          }
          if (error) {
            errorLog(`mkdir 명령어 실행 오류: ${targetPath}`, error);
            return reject(error);
          }
          resolve();
        });
      });
      
      log(`폴더 생성 작업 완료 (mkdir 명령어 사용): ${targetPath}`, 'info'); // info 레벨
    } else {
      if (timeoutId) clearTimeout(timeoutId); 
      errorLog('지원되지 않는 작업입니다.', { operation });
      process.exit(1);
    }

    if (timeoutId) clearTimeout(timeoutId); 
    process.exit(0); 

  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId); 
    errorLog(`${operation} 작업 중 오류 발생: ${targetPath}`, error);
    process.exit(1); 
  }
})();