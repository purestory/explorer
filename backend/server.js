const express = require('express');
const webdav = require('webdav-server').v2;
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { execSync, fork } = require('child_process');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const app = express();
const PORT = process.env.PORT || 3333;
const archiver = require('archiver');
const { promisify } = require('util');

// --- 전역 오류 처리기 추가 ---
process.on('uncaughtException', (error) => {
  errorLog('처리되지 않은 예외 발생:', error);
  // 여기서는 로깅만 하고, 아래 SIGTERM 핸들러에서 정리 및 종료를 유도
  // 필요한 경우 추가적인 즉시 정리 작업 수행 가능
  // process.exit(1); // 즉시 종료 대신 아래 SIGTERM 핸들러에 맡김
});

process.on('unhandledRejection', (reason, promise) => {
  errorLog('처리되지 않은 Promise 거부 발생:', reason);
  // 여기서는 로깅만 하고, 아래 SIGTERM 핸들러에서 정리 및 종료를 유도
  // process.exit(1); // 즉시 종료 대신 아래 SIGTERM 핸들러에 맡김
});

// --- 활성 워커 프로세스 관리 --- 
const activeWorkers = new Set(); // 활성 워커의 참조를 저장할 Set

// --- 초기 디렉토리 설정 및 검사 (비동기 함수) ---
const LOGS_DIRECTORY = path.join(__dirname, 'logs');
const ROOT_DIRECTORY = path.join(__dirname, 'share-folder');
const TMP_UPLOAD_DIR = path.join(__dirname, 'tmp'); // 임시 디렉토리 경로 정의 추가

// *** 로그 파일 스트림 변수 선언 (위치 조정) ***
let logFile;
let errorLogFile;

// *** 로그 스트림 설정 함수 정의 (위치 조정) ***
function setupLogStreams() {
  // 파일 스트림 생성 로직
  try {
    logFile = fs.createWriteStream(path.join(LOGS_DIRECTORY, 'server.log'), { flags: 'a' });
    errorLogFile = fs.createWriteStream(path.join(LOGS_DIRECTORY, 'error.log'), { flags: 'a' });
    console.log('Log streams setup complete.'); // 확인용 콘솔 로그
  } catch (streamError) {
    // 스트림 생성 실패 시 콘솔에 오류 출력 (파일 로깅 불가 상태)
    console.error('FATAL: Failed to create log streams:', streamError);
    process.exit(1); // 심각한 오류로 간주하고 종료
  }
}
async function initializeDirectories() {
  try {
    // 로그 디렉토리 확인 및 생성 (비동기)
    try {
      await fs.promises.access(LOGS_DIRECTORY);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.promises.mkdir(LOGS_DIRECTORY, { recursive: true });
        // *** 초기 로그는 console 사용 ***
        console.log(`로그 디렉토리 생성됨: ${LOGS_DIRECTORY}`); 
      } else {
        throw error; // 접근 오류 외 다른 오류는 전파
      }
    }

    // *** 로그 스트림 설정 호출 위치 변경 ***
    setupLogStreams(); 

    // 루트 공유 디렉토리 확인 및 생성 (비동기)
    try {
      await fs.promises.access(ROOT_DIRECTORY);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.promises.mkdir(ROOT_DIRECTORY, { recursive: true });
        // *** 이제 log 함수 사용 가능 ***
        log(`루트 디렉토리 생성됨: ${ROOT_DIRECTORY}`, 'info'); 
      } else {
        throw error;
      }
    }

    // 루트 공유 디렉토리 권한 설정 (비동기)
    await fs.promises.chmod(ROOT_DIRECTORY, 0o777);
    log(`루트 디렉토리 권한 설정됨: ${ROOT_DIRECTORY}`, 'info');

    // *** 임시 업로드 디렉토리 확인 및 생성 (비동기) ***
    try {
      await fs.promises.access(TMP_UPLOAD_DIR);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.promises.mkdir(TMP_UPLOAD_DIR, { recursive: true });
        log(`임시 업로드 디렉토리 생성됨: ${TMP_UPLOAD_DIR}`, 'info');
      } else {
        throw error;
      }
    }

  } catch (initError) {
    // *** 여기서는 errorLog 대신 console.error 사용 (errorLogFile 보장 안됨) ***
    console.error('초기 디렉토리 설정 중 심각한 오류 발생:', initError);
    process.exit(1); // 초기화 실패 시 서버 시작 중단
  }
}


// --- 로그 레벨 및 모드 설정 ---
const LOG_LEVELS = { minimal: 0, info: 1, debug: 2 };
const isDevelopment = process.env.NODE_ENV === 'development';
let currentLogLevel = isDevelopment ? LOG_LEVELS.info : LOG_LEVELS.minimal;
const requestLogLevel = isDevelopment ? 'info' : 'minimal'; // 요청 로그 레벨

console.log(`Server running in ${isDevelopment ? 'development' : 'production'} mode.`);
console.log(`Initial log level set to: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLogLevel)} (${currentLogLevel})`);
console.log(`Request log level set to: ${requestLogLevel}`);

// 로그 레벨 설정 함수
function setLogLevel(levelName) {
  if (LOG_LEVELS.hasOwnProperty(levelName)) {
    currentLogLevel = LOG_LEVELS[levelName];
    log(`Log level set to: ${levelName} (${currentLogLevel})`, 'info'); // 로그 레벨 변경은 info 레벨
  } else {
    errorLog(`Invalid log level specified: ${levelName}. Keeping current level: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLogLevel)}`);
  }
}



function setupLogStreams() {
  logFile = fs.createWriteStream(path.join(LOGS_DIRECTORY, 'server.log'), { flags: 'a' });
  errorLogFile = fs.createWriteStream(path.join(LOGS_DIRECTORY, 'error.log'), { flags: 'a' });
}

// --- 로그 함수 수정 ---
function log(message, levelName = 'debug') {
  const level = LOG_LEVELS[levelName] !== undefined ? LOG_LEVELS[levelName] : LOG_LEVELS.debug;
  if (level > currentLogLevel) return; // 현재 레벨보다 높은 레벨의 로그는 기록하지 않음

  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const year = kstDate.getUTCFullYear();
  const month = (kstDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = kstDate.getUTCDate().toString().padStart(2, '0');
  const hours = kstDate.getUTCHours().toString().padStart(2, '0');
  const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
  const seconds = kstDate.getUTCSeconds().toString().padStart(2, '0');
  const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} KST`;

  // 로그 레벨 태그 제거
  const logMessage = `${timestamp} - ${message}\n`;
  logFile.write(logMessage);
  console.log(`${timestamp} - ${message}`); // 콘솔 로그에도 태그 제거
}

function logWithIP(message, req, levelName = 'debug') {
  const level = LOG_LEVELS[levelName] !== undefined ? LOG_LEVELS[levelName] : LOG_LEVELS.debug;
  if (level > currentLogLevel) return;

  let ip = 'unknown';
  if (req && req.headers) {
    ip = req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         (req.connection && req.connection.remoteAddress) ||
         (req.socket && req.socket.remoteAddress) ||
         (req.connection && req.connection.socket && req.connection.socket.remoteAddress) ||
         'unknown';
  }

  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const year = kstDate.getUTCFullYear();
  const month = (kstDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = kstDate.getUTCDate().toString().padStart(2, '0');
  const hours = kstDate.getUTCHours().toString().padStart(2, '0');
  const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
  const seconds = kstDate.getUTCSeconds().toString().padStart(2, '0');
  const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} KST`;

  // 로그 레벨 태그 제거, IP 정보는 유지
  const logMessage = `${timestamp} - [IP: ${ip}] ${message}\n`;
  logFile.write(logMessage);
  console.log(`${timestamp} - [IP: ${ip}] ${message}`); // 콘솔 로그에도 태그 제거
}

// errorLog 함수는 이제 setupLogStreams 호출 후 안전하게 errorLogFile 사용 가능
function errorLog(message, error) { // 오류 로그는 항상 기록
  const now = new Date();
  // ... (timestamp 생성 로직) ...
  const logMessage = `${timestamp} - ERROR: ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;
  
  // *** errorLogFile이 정의되었는지 확인 후 사용 (안전성 강화) ***
  if (errorLogFile && errorLogFile.writable) { 
    errorLogFile.write(logMessage);
  } else {
    // 스트림 준비 안됐으면 콘솔에만 출력
    console.error(message, error); 
  }
  console.error(message, error); // 콘솔에는 항상 출력
}

function errorLogWithIP(message, error, req) { // 오류 로그는 항상 기록
  // ... (ip 및 timestamp 생성 로직) ...
  const logMessage = `${timestamp} - ERROR: [IP: ${ip}] ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;

  // *** errorLogFile이 정의되었는지 확인 후 사용 (안전성 강화) ***
  if (errorLogFile && errorLogFile.writable) {
    errorLogFile.write(logMessage);
  } else {
    console.error(`[IP: ${ip}] ${message}`, error); // 콘솔에는 항상 출력
  }
  console.error(`[IP: ${ip}] ${message}`, error); // 콘솔에는 항상 출력
}




// 최대 저장 용량 설정 (100GB)
const MAX_STORAGE_SIZE = 100 * 1024 * 1024 * 1024; // 100GB in bytes

// 최대 파일명/경로 길이 제한 설정 (전역으로 이동)
const MAX_FILENAME_BYTES = 229;
const MAX_PATH_BYTES = 3800; // 일반적인 최대값보다 안전한 값으로 설정

async function getDiskUsage() {
  const forceLogLevel = 'minimal'; // 로그 레벨 무시하고 항상 출력
  let commandOutput = null; // exec 결과 저장 변수

  try {
    const command = `du -sb ${ROOT_DIRECTORY}`;
    log(`[DiskUsage] Executing command: ${command}`, forceLogLevel);

    // *** exec 결과 전체 로깅 ***
    commandOutput = await exec(command);
    log(`[DiskUsage] exec result: ${JSON.stringify(commandOutput)}`, forceLogLevel); 

    const { stdout, stderr } = commandOutput;
    const stdoutTrimmed = stdout ? stdout.trim() : ''; // stdout이 null/undefined일 경우 대비

    log(`[DiskUsage] Raw stdout: [${stdoutTrimmed}]`, forceLogLevel);
    if (stderr) {
      errorLog(`[DiskUsage] du command stderr: [${stderr.trim()}]`); 
    }

    // 파싱 시도
    const outputString = stdoutTrimmed;
    const match = outputString.match(/^(\d+)/); 
    const parsedValue = match ? match[1] : null; // 파싱된 숫자 문자열
    log(`[DiskUsage] Parsed value string: ${parsedValue}`, forceLogLevel);

    const usedBytes = parsedValue ? parseInt(parsedValue, 10) : NaN;
    log(`[DiskUsage] Parsed usedBytes (number): ${usedBytes}`, forceLogLevel);

    if (isNaN(usedBytes)) {
      errorLog('[DiskUsage] 디스크 사용량 파싱 오류: 숫자로 변환 실패', { stdout: outputString });
      throw new Error('Failed to parse disk usage output.');
    }

    log(`[DiskUsage] 디스크 사용량 조회 (파싱 성공): ${usedBytes} bytes`, forceLogLevel);

    return {
      used: usedBytes,
      total: MAX_STORAGE_SIZE,
      available: MAX_STORAGE_SIZE - usedBytes,
      percent: Math.round((usedBytes / MAX_STORAGE_SIZE) * 100)
    };
  } catch (error) {
    errorLog('[DiskUsage] 디스크 사용량 확인 오류:', { 
        message: error.message, 
        stack: error.stack,
        execResult: commandOutput // 오류 발생 시 exec 결과도 로깅
    });
    return {
      used: 0,
      total: MAX_STORAGE_SIZE,
      available: MAX_STORAGE_SIZE,
      percent: 0
    };
  }
}


// WebDAV 서버 설정
const server = new webdav.WebDAVServer({
  httpAuthentication: new webdav.HTTPBasicAuthentication(
    async (username, password) => {
      // 간단한 사용자 인증 (실제 서비스에서는 보안을 강화해야 함)
      return username === 'admin' && password === 'admin';
    }
  )
});

// WebDAV 파일시스템 설정
const fileSystem = new webdav.PhysicalFileSystem(ROOT_DIRECTORY);
server.setFileSystem('/', fileSystem);

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Destination, Overwrite');
  
  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// 용량 확인 미들웨어
app.use((req, res, next) => {
  // 파일 업로드 요청의 경우 용량 체크 - 일시적으로 주석 처리
  /*
  if (req.method === 'POST' && req.path === '/api/upload') {
    const diskUsage = getDiskUsage();
    
    // Content-Length 헤더가 있으면 업로드 크기 체크
    if (req.headers['content-length']) {
      const uploadSize = parseInt(req.headers['content-length']);
      
      // 업로드 후 용량 초과 확인
      if (diskUsage.used + uploadSize > MAX_STORAGE_SIZE) {
        return res.status(507).json({
          error: '저장 공간 부족',
          message: '저장 공간이 부족합니다. 파일을 삭제하고 다시 시도해 주세요.',
          diskUsage
        });
      }
    }
  }
  */
  
  next();
});

// Express 내장 body-parser 설정 (크기 제한 증가)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 임시 업로드 디렉토리 설정 (제거)
// const TMP_UPLOAD_DIR = path.join(__dirname, 'tmp');

// Multer 설정 (Disk Storage 사용 - 요청별 임시 폴더 생성, 비동기화)
const storage = multer.diskStorage({
  destination: async function (req, file, cb) { // *** async 추가 ***
    // 각 요청별 고유 임시 디렉토리 생성
    if (!req.uniqueTmpDir) {
      const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
      req.uniqueTmpDir = path.join(TMP_UPLOAD_DIR, uniqueId);
      try {
        // *** mkdir 비동기화 ***
        await fs.promises.mkdir(req.uniqueTmpDir, { recursive: true });
        logWithIP(`[Multer] 요청별 임시 디렉토리 생성: ${req.uniqueTmpDir}`, req);
      } catch (mkdirError) {
        errorLogWithIP('[Multer] 임시 디렉토리 생성 오류', mkdirError, req);
        return cb(mkdirError); // *** 에러 콜백 호출 ***
      }
    }
    cb(null, req.uniqueTmpDir); // *** 성공 콜백 호출 ***
  },
  filename: function (req, file, cb) {
    // 파일명 충돌 방지 및 인코딩 변환 제거
    // file.originalname을 직접 사용하고 필요한 특수문자만 제거
    const safeOriginalName = file.originalname.replace(/[/\\:*?\"<>|]/g, '_');
    // 로그 추가: 변환 전후 이름 확인
    if (safeOriginalName !== file.originalname) {
        logWithIP(`[Multer Filename] 특수문자 제거됨: '${file.originalname}' -> '${safeOriginalName}'`, req);
    }
    cb(null, Date.now() + '-' + Math.random().toString(36).substring(2, 9) + '-' + safeOriginalName);
  }
});

const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB
    fieldSize: 50 * 1024 * 1024 // 50MB (이전 설정 유지)
  }
});

// 기본 미들웨어 설정
app.use(express.static(path.join(__dirname, '../frontend')));

// --- 로그 미들웨어 (모드 기반 레벨 적용 및 원래 방식으로 복원) ---
app.use((req, res, next) => {
  logWithIP(`${req.method} ${req.url}`, req, requestLogLevel);
  res.on('finish', () => {
    logWithIP(`${req.method} ${req.url} - ${res.statusCode}`, req, requestLogLevel);
  });
  next();
});

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 파일 업로드 API 수정 (비동기화 및 병렬 처리 제한)
app.post('/api/upload', uploadMiddleware.any(), async (req, res) => {
  // *** 동적 import 추가 ***
  const pLimit = (await import('p-limit')).default;

  // *** 전체 핸들러 로직을 감싸는 try 블록 시작 (기존 유지) ***
  try {
    // minimal 레벨 로그: 요청 시작/종료는 로깅 미들웨어에서 처리

    // 1. 기존 오류 처리 및 정보 파싱 (이전 상태로 복구)
    if (!req.files || req.files.length === 0) {
      errorLogWithIP('업로드 요청에 파일이 없거나 처리 중 오류 발생.', null, req);
      return res.status(400).json({ error: '파일이 없거나 업로드 처리 중 오류가 발생했습니다.' }); 
    }
    if (!req.body.fileInfo) {
      errorLogWithIP('업로드 요청에 파일 정보(fileInfo)가 없습니다.', null, req);
      return res.status(400).json({ error: '파일 정보가 누락되었습니다.' });
    }

    const baseUploadPath = req.body.path || '';
    const rootUploadDir = path.join(ROOT_DIRECTORY, baseUploadPath);
    let fileInfoArray;
    try {
      fileInfoArray = JSON.parse(req.body.fileInfo);
      // --- 추가: minimal 레벨 작업 상세 로그 (파일명 포함) ---
      const fileCount = fileInfoArray.length;
      let fileSummary = '';
      if (fileCount > 0) {
          if (fileCount <= 3) {
              fileSummary = fileInfoArray.map(f => `'${f.originalName}'`).join(', ');
          } else {
              fileSummary = fileInfoArray.slice(0, 3).map(f => `'${f.originalName}'`).join(', ') + ` 외 ${fileCount - 3}개`;
          }
      } else {
          fileSummary = '0개'; // 파일이 없는 경우
      }
      logWithIP(`[Upload Request] ${fileSummary} 파일 업로드 요청 (${baseUploadPath || '루트'})`, req, 'minimal');
      // ----------------------------------------------
      logWithIP(`[Upload Start] 파일 정보 수신: ${fileInfoArray.length}개 항목`, req, 'info');
    } catch (parseError) {
      errorLogWithIP('fileInfo JSON 파싱 오류:', parseError, req);
      return res.status(400).json({ error: '잘못된 파일 정보 형식입니다.' });
    }
    logWithIP(`기본 업로드 경로: ${baseUploadPath || '루트'}, 절대 경로: ${rootUploadDir}`, req);

    // 2. 처리 변수 초기화 (이전 상태로 복구)
    const processedFiles = [];
    const errors = [];

    // 파일명 길이 제한 함수 (바이트 기준)
    function truncateFileName(filename) {
      const originalBytes = Buffer.byteLength(filename);
      log(`[Filename Check] 파일명 길이 확인 시작: ${filename} (${originalBytes} bytes)`, 'debug');
      if (originalBytes <= MAX_FILENAME_BYTES) {
        return filename;
      }
      const extension = filename.lastIndexOf('.') > 0 ? filename.substring(filename.lastIndexOf('.')) : '';
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.') > 0 ? filename.lastIndexOf('.') : filename.length);
      let truncatedName = nameWithoutExt;
      while (Buffer.byteLength(truncatedName + '...' + extension) > MAX_FILENAME_BYTES) {
        truncatedName = truncatedName.slice(0, -1);
        if (truncatedName.length === 0) break;
      }
      const newFileName = truncatedName + '...' + extension;
      log(`[Filename Check] 파일명 길이 제한 결과: '${newFileName}' (${Buffer.byteLength(newFileName)} bytes)`, 'debug');
      return newFileName;
    }

    // 경로 길이 확인 및 제한 함수
    function checkAndTruncatePath(fullPath) {
      const fullPathBytes = Buffer.byteLength(fullPath);
      log(`[Path Check] 경로 길이 확인 시작: ${fullPath} (${fullPathBytes} bytes)`, 'debug');
      if (fullPathBytes <= MAX_PATH_BYTES) {
        return { path: fullPath, truncated: false };
      }
      log(`[Path Check] 경로가 너무 깁니다(Bytes: ${fullPathBytes}): ${fullPath}`);
      const pathParts = fullPath.split(path.sep);
      const driveOrRoot = pathParts[0] || '/';
      const lastElement = pathParts[pathParts.length - 1];
      const isLastElementFile = lastElement.includes('.');
      const fileNameBytes = isLastElementFile ? Buffer.byteLength(lastElement) : 0;
      const rootBytes = Buffer.byteLength(driveOrRoot);
      const separatorBytes = (pathParts.length - 1) * Buffer.byteLength(path.sep);
      const totalDirBytes = MAX_PATH_BYTES - fileNameBytes - rootBytes - separatorBytes;
      const dirCount = isLastElementFile ? pathParts.length - 2 : pathParts.length - 1;
      const avgMaxBytes = Math.max(20, Math.floor(totalDirBytes / (dirCount > 0 ? dirCount : 1)));
      const truncatedParts = [driveOrRoot];
      let bytesUsed = rootBytes + separatorBytes;
      for (let i = 1; i < pathParts.length; i++) {
        let part = pathParts[i];
        const partBytes = Buffer.byteLength(part);
        if (i === pathParts.length - 1 && isLastElementFile) {
          if (partBytes > MAX_FILENAME_BYTES) {
            part = truncateFileName(part);
          }
          truncatedParts.push(part);
          continue;
        }
        if (partBytes > avgMaxBytes) {
          let truncatedPart = '';
          for (let j = 0; j < part.length; j++) {
            const nextChar = part[j];
            const potentialNew = truncatedPart + nextChar;
            if (Buffer.byteLength(potentialNew + '...') <= avgMaxBytes) {
              truncatedPart = potentialNew;
            } else {
              break;
            }
          }
          if (truncatedPart.length === 0 && part.length > 0) {
            truncatedPart = part.substring(0, 1);
          }
          part = truncatedPart + '...';
        }
        truncatedParts.push(part);
        bytesUsed += Buffer.byteLength(part) + Buffer.byteLength(path.sep);
      }
      const truncatedPath = truncatedParts.join(path.sep);
      const finalPathBytes = Buffer.byteLength(truncatedPath);
      log(`[Path Check] 경로 길이 제한 결과: '${truncatedPath}' (${finalPathBytes} bytes)`, 'debug');
      if (finalPathBytes > MAX_PATH_BYTES) {
        const rootAndFile = isLastElementFile ? 
          [driveOrRoot, truncateFileName(lastElement)] : 
          [driveOrRoot, truncatedParts[truncatedParts.length - 1]];
        const emergencyPath = rootAndFile.join(path.sep + '...' + path.sep);
        log(`[Path Check] 비상 경로 축소: ${truncatedPath} → ${emergencyPath}`);
        return { path: emergencyPath, truncated: true, emergency: true };
      }
      return { path: truncatedPath, truncated: true };
    }

    // 4. 파일 처리 루프 (내부 비동기화 및 병렬 처리 제한)
    const CONCURRENCY_LIMIT = 100; // *** 동시 처리 개수 제한 설정 ***
    const limit = pLimit(CONCURRENCY_LIMIT);

    const uploadPromises = fileInfoArray.map((fileInfo) => {
      // *** 각 비동기 작업을 limit으로 감싸기 ***
      return limit(async () => {
        logWithIP(`[Upload Loop] 처리 시작: ${fileInfo.originalName}, 상대 경로: ${fileInfo.relativePath}`, req, 'debug');
        
        const expectedFieldName = `file_${fileInfo.index}`;
        const uploadedFile = req.files.find(f => f.fieldname === expectedFieldName);

        if (!uploadedFile) {
          const errorMessage = `[Upload Loop] 업로드된 파일 객체를 찾을 수 없음: ${expectedFieldName} (원본명: ${fileInfo.originalName})`;
          errorLogWithIP(errorMessage, null, req);
          return { 
            originalName: fileInfo.originalName, 
            status: 'error', 
            message: '서버에서 해당 파일 데이터를 찾을 수 없습니다.',
            errorDetail: errorMessage
          }; 
        }
        
        logWithIP(`[Upload Loop] 파일 발견: ${uploadedFile.filename} (원본: ${fileInfo.originalName})`, req, 'debug');

        // 대상 경로 및 파일명 결정
        const targetDirPath = path.join(rootUploadDir, fileInfo.relativePath || '');
        const finalFileName = truncateFileName(fileInfo.originalName); // 파일명 길이 제한 적용
        let targetFilePath = path.join(targetDirPath, finalFileName);

        logWithIP(`[Upload Loop] 대상 경로 계산: ${targetFilePath}`, req, 'debug');
        
        // 경로 길이 확인 및 제한
        const pathCheckResult = checkAndTruncatePath(targetFilePath);
        if (pathCheckResult.truncated) {
            targetFilePath = pathCheckResult.path;
            logWithIP(`[Upload Loop] 경로 길이 제한 적용됨: ${targetFilePath}`, req, 'info');
            if (pathCheckResult.emergency) {
                logWithIP(`[Upload Loop] 경로 길이 비상 축소 적용됨: ${targetFilePath}`, req, 'warning');
            }
        }
        
        // 최종 대상 디렉토리 (파일명 제외)
        const finalTargetDir = path.dirname(targetFilePath);

        try {
          // 대상 디렉토리 생성 (비동기)
          await fs.promises.mkdir(finalTargetDir, { recursive: true });
          logWithIP(`[Upload Loop] 대상 디렉토리 생성/확인: ${finalTargetDir}`, req, 'debug');

          // *** 파일 이동 시도 (rename 우선, EXDEV 시 copy+unlink) ***
          try {
            // 1. rename 시도
            await fs.promises.rename(uploadedFile.path, targetFilePath);
            logWithIP(`[Upload Loop] 파일 이동(rename) 완료: ${uploadedFile.path} -> ${targetFilePath}`, req, 'debug');
          } catch (renameError) {
            // 2. rename 실패 시
            if (renameError.code === 'EXDEV') {
              // EXDEV 오류: 다른 파일 시스템 간 이동 시도 -> 복사+삭제로 대체
              logWithIP(`[Upload Loop] rename 실패 (EXDEV), copy+unlink로 대체: ${uploadedFile.path} -> ${targetFilePath}`, req, 'warn');
              await fs.promises.copyFile(uploadedFile.path, targetFilePath);
              await fs.promises.unlink(uploadedFile.path); 
              logWithIP(`[Upload Loop] 파일 복사+삭제 완료: ${targetFilePath}`, req, 'debug');
            } else {
              // EXDEV 외 다른 rename 오류는 상위 catch로 전파
              throw renameError;
            }
          }
          // *** 파일 이동/복사 후에는 임시 파일이 없으므로 unlink 호출 제거 ***
          // await fs.promises.unlink(uploadedFile.path);
          // logWithIP(`[Upload Loop] 임시 파일 삭제 완료: ${uploadedFile.path}`, req, 'debug');

          // 성공 결과 반환
          return {
            originalName: fileInfo.originalName,
            newName: finalFileName, // 길이 제한 적용된 이름
            relativePath: fileInfo.relativePath,
            newPath: targetFilePath, // 길이 제한 적용된 전체 경로
            status: 'success',
            truncated: pathCheckResult.truncated
          };
        } catch (writeError) {
          const errorMessage = `[Upload Loop] 파일 처리 오류 (${fileInfo.originalName}): ${writeError.message}`;
          errorLogWithIP(errorMessage, writeError, req);
          // 오류 발생 시에도 임시 파일 삭제 시도 (오류 무시, rename 실패 후 copy실패 등)
          fs.promises.unlink(uploadedFile.path).catch(unlinkErr => {
              if (unlinkErr.code !== 'ENOENT') { // 파일이 이미 없는 경우는 무시
                  errorLogWithIP(`[Upload Loop] 오류 후 임시 파일 삭제 실패 (${uploadedFile.path})`, unlinkErr, req);
              }
          });
          return {
            originalName: fileInfo.originalName,
            status: 'error',
            message: '파일 저장 중 오류가 발생했습니다.',
            errorDetail: errorMessage
          };
        }
      }); // limit(async () => ...) 끝
    }); // fileInfoArray.map 끝

    // 모든 파일 처리 Promise가 완료될 때까지 기다림 (동시 실행은 제한됨)
    const results = await Promise.all(uploadPromises);
    logWithIP(`[Upload End] 모든 파일 처리 완료 (${results.length}개)`, req, 'info');

    // 5. 임시 요청 디렉토리 정리 (이전 상태로 복구)
    if (req.uniqueTmpDir) {
      try {
        await fs.promises.rm(req.uniqueTmpDir, { recursive: true, force: true });
        logWithIP(`[Upload Cleanup] 임시 요청 디렉토리 삭제 완료: ${req.uniqueTmpDir}`, req, 'debug');
      } catch (cleanupError) {
        errorLogWithIP(`[Upload Cleanup] 임시 요청 디렉토리 삭제 실패: ${req.uniqueTmpDir}`, cleanupError, req);
      }
    }

    // 6. 결과 집계 및 응답 (이전 상태로 복구)
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.length - successCount;
    const errorsDetails = results.filter(r => r.status === 'error');

    logWithIP(`[Upload Result] 성공: ${successCount}, 실패: ${errorCount}`, req, 'minimal');

    if (errorCount > 0) {
      res.status(207).json({ // 207 Multi-Status 사용
        message: `파일 업로드 완료 (${successCount}개 성공, ${errorCount}개 실패)`,
        processedFiles: results, // 각 파일별 상세 결과 포함
        errors: errorsDetails
      });
    } else {
      res.status(200).json({ 
        message: '모든 파일이 성공적으로 업로드되었습니다.',
        processedFiles: results // 성공 시에도 상세 결과 제공
      });
    }

  } catch (error) {
    // *** 전체 핸들러의 예외 처리 (기존 유지) ***
    errorLogWithIP('파일 업로드 API 처리 중 예외 발생:', error, req);
    // 오류 발생 시에도 임시 요청 디렉토리 삭제 시도
    if (req.uniqueTmpDir) {
        fs.promises.rm(req.uniqueTmpDir, { recursive: true, force: true }).catch(cleanupError => {
            errorLogWithIP('[Upload Error Cleanup] 오류 발생 후 임시 요청 디렉토리 삭제 실패', cleanupError, req);
        });
    }
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.', details: error.message });
  }
});

// 바이트 단위를 읽기 쉬운 형식으로 변환하는 함수
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 유틸리티 함수
function getFileIconClass(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  // 파일 확장자별 아이콘 클래스
  const iconMap = {
    '.pdf': 'far fa-file-pdf',
    '.doc': 'far fa-file-word',
    '.docx': 'far fa-file-word',
    '.xls': 'far fa-file-excel',
    '.xlsx': 'far fa-file-excel',
    '.ppt': 'far fa-file-powerpoint',
    '.pptx': 'far fa-file-powerpoint',
    '.jpg': 'far fa-file-image',
    '.jpeg': 'far fa-file-image',
    '.png': 'far fa-file-image',
    '.gif': 'far fa-file-image',
    '.txt': 'far fa-file-alt',
    '.zip': 'far fa-file-archive',
    '.rar': 'far fa-file-archive',
    '.mp3': 'far fa-file-audio',
    '.wav': 'far fa-file-audio',
    '.mp4': 'far fa-file-video',
    '.mov': 'far fa-file-video',
    '.js': 'far fa-file-code',
    '.html': 'far fa-file-code',
    '.css': 'far fa-file-code',
    '.json': 'far fa-file-code',
  };

  return iconMap[ext] || 'far fa-file';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// WebDAV 서버 구성
app.use('/webdav', webdav.extensions.express('/webdav', server));

// 디스크 사용량 확인 API
app.get('/api/disk-usage', async (req, res) => { // *** async 추가 ***
  try {
    // *** await 추가 ***
    const diskUsage = await getDiskUsage(); 
    // 로그 메시지에는 formatBytes 적용된 값이 들어가므로 이전 로그는 제거하거나 debug 레벨로 변경 고려
    // log(`디스크 사용량 조회: ${formatFileSize(diskUsage.used)} / ${formatFileSize(diskUsage.total)} (${diskUsage.percent}%)`, 'info'); // 일단 주석 처리
    res.json(diskUsage); // 실제 결과 객체 반환
  } catch (error) {
    errorLog('디스크 사용량 조회 API 오류:', error); // 오류 로그 메시지 명확화
    res.status(500).json({
      error: '디스크 사용량 조회 중 오류가 발생했습니다.'
    });
  }
});

// 파일 압축 API (비동기화)
app.post('/api/compress', bodyParser.json(), async (req, res) => { // *** async 추가 ***
  try {
    const { files, targetPath, zipName } = req.body;
    
    logWithIP(`[Compress Request] ${files.length}개 파일 '${zipName}'으로 압축 요청 (${targetPath || '루트'})`, req, 'minimal');

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: '압축할 파일이 선택되지 않았습니다.' });
    }
    
    if (!zipName) {
      return res.status(400).json({ error: '압축 파일 이름이 필요합니다.' });
    }
    
    log(`압축 요청: ${files.length}개 파일, 대상 경로: ${targetPath || '루트'}, 압축파일명: ${zipName}`, 'info');
    
    const basePath = targetPath ? path.join(ROOT_DIRECTORY, targetPath) : ROOT_DIRECTORY;
    const zipFilePath = path.join(basePath, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`);
    
    // *** 중복 확인 (비동기) ***
    try {
      await fs.promises.access(zipFilePath);
      // 파일이 존재하면 409 Conflict 반환
      return res.status(409).json({ error: '같은 이름의 압축 파일이 이미 존재합니다.' });
    } catch (error) {
      if (error.code !== 'ENOENT') { 
        // 접근 오류 외 다른 오류는 로깅 후 500 반환
        errorLog('압축 파일 존재 확인 오류:', error);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
      // ENOENT 오류는 파일이 없다는 의미이므로 정상 진행
    }
    
    // zip 명령어 구성
    let baseZipCommand = `cd "${ROOT_DIRECTORY}" && zip -0 -r "${zipFilePath}"`;
    let commandSuffix = '';
    
    // *** 파일 경로 추가 (비동기 확인 및 병렬 처리) ***
    const checkPromises = files.map(async (file) => {
      const filePath = targetPath ? `${targetPath}/${file}` : file;
      const fullPath = path.join(ROOT_DIRECTORY, filePath);
      
      try {
        await fs.promises.access(fullPath); // 존재 확인
        const relativePath = path.relative(ROOT_DIRECTORY, fullPath);
        return ` "${relativePath}"`; // 존재하면 경로 문자열 반환
      } catch (error) {
        if (error.code !== 'ENOENT') {
          errorLog(`압축 대상 접근 오류: ${fullPath}`, error);
        }
        return null; // 존재하지 않거나 오류 시 null 반환
      }
    });

    const checkedPaths = (await Promise.all(checkPromises)).filter(p => p !== null);

    if (checkedPaths.length === 0) {
      return res.status(400).json({ error: '압축할 유효한 파일/폴더가 없습니다.' });
    }

    commandSuffix = checkedPaths.join('');
    const zipCommand = baseZipCommand + commandSuffix;
    
    // *** 압축 실행 (비동기) ***
    log(`실행 명령어: ${zipCommand}`, 'debug');
    const { stdout: zipStdout, stderr: zipStderr } = await exec(zipCommand);
    if (zipStderr) {
      errorLog('압축 명령어 실행 중 stderr 발생:', zipStderr);
      // stderr가 있다고 무조건 오류는 아닐 수 있으나, 로깅은 필요
    }
    log(`압축 명령어 stdout: ${zipStdout}`, 'debug');
    
    // *** 압축 파일 권한 설정 (비동기) ***
    await fs.promises.chmod(zipFilePath, 0o666);
    
    log(`압축 완료: ${zipFilePath}`, 'info');
    res.status(200).json({ 
      success: true, 
      message: '압축이 완료되었습니다.',
      zipFile: path.basename(zipFilePath),
      zipPath: targetPath || ''
    });

  } catch (error) {
    errorLog('압축 API 오류:', error);
    res.status(500).json({ error: '파일 압축 중 오류가 발생했습니다.', message: error.message });
  }
});

// 폴더 잠금 상태 조회 API (비동기화)
app.get('/api/lock-status', async (req, res) => { // *** async 추가 ***
  try {
    const lockedFoldersPath = path.join(__dirname, 'lockedFolders.json');
    let lockState = [];
    
    // *** 파일 존재 확인 및 읽기 (비동기) ***
    try {
      const fileContent = await fs.promises.readFile(lockedFoldersPath, 'utf8');
      lockState = JSON.parse(fileContent).lockState || [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 파일이 없으면 빈 배열로 초기화하고 파일 생성 (비동기)
        log('lockedFolders.json 파일 없음. 새로 생성합니다.', 'info');
        try {
          await fs.promises.writeFile(lockedFoldersPath, JSON.stringify({ lockState: [] }), 'utf8');
        } catch (writeError) {
          errorLog('lockedFolders.json 파일 생성 오류:', writeError);
          // 파일 생성 실패 시에도 빈 배열로 응답
        }
      } else {
        // 파싱 오류 또는 기타 읽기 오류
        errorLog('잠긴 폴더 목록 읽기/파싱 오류:', error);
        // 오류 발생 시에도 일단 빈 배열로 응답 (클라이언트 오류 방지)
      }
    }
    
    log(`잠금 상태 조회 완료: ${lockState.length}개 폴더 잠김`, 'info');
    res.status(200).json({ lockState });

  } catch (error) {
    // 핸들러 자체의 예외 처리
    errorLog('잠금 상태 조회 API 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 폴더 잠금/해제 API (비동기화)
app.post('/api/lock/:path(*)', express.json(), async (req, res) => { // *** async 추가, express.json() 미들웨어 추가 ***
  try {
    const folderPath = decodeURIComponent(req.params.path || '');
    const action = req.body.action || 'lock'; // 'lock' 또는 'unlock'
    const fullPath = path.join(ROOT_DIRECTORY, folderPath);
    
    logWithIP(`[Lock Request] '${folderPath}' ${action === 'lock' ? '잠금' : '잠금 해제'} 요청`, req, 'minimal');
    log(`폴더 ${action === 'lock' ? '잠금' : '잠금 해제'} 요청: ${fullPath}`, 'info');

    let stats;
    // *** 폴더 존재 및 정보 확인 (비동기) ***
    try {
      stats = await fs.promises.stat(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        errorLogWithIP(`폴더를 찾을 수 없음: ${fullPath}`, null, req);
        return res.status(404).send('폴더를 찾을 수 없습니다.');
      } else {
        errorLogWithIP(`폴더 정보 확인 오류: ${fullPath}`, error, req);
        return res.status(500).send('서버 오류가 발생했습니다.');
      }
    }

    // 디렉토리인지 확인
    if (!stats.isDirectory()) {
      errorLogWithIP(`잠금 대상이 폴더가 아님: ${fullPath}`);
      return res.status(400).send('폴더만 잠금/해제할 수 있습니다.');
    }

    // lockedFolders.json 파일 로드 (비동기)
    const lockedFoldersPath = path.join(__dirname, 'lockedFolders.json');
    let lockedFolders = { lockState: [] }; // 기본값
    try {
      const fileContent = await fs.promises.readFile(lockedFoldersPath, 'utf8');
      lockedFolders = JSON.parse(fileContent);
      if (!lockedFolders.lockState) {
        lockedFolders.lockState = [];
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        log('lockedFolders.json 파일 없음. 새로 생성합니다.', 'info');
        // 파일 없으면 기본값 사용 (저장 시 파일 생성됨)
      } else {
        errorLog('잠긴 폴더 목록 읽기/파싱 오류:', error);
        // 읽기/파싱 오류 시에도 일단 기본값으로 진행하나, 저장은 시도
      }
    }

    // 잠금 또는 해제 처리
    let changed = false;
    if (action === 'lock') {
      if (!lockedFolders.lockState.includes(folderPath)) {
        const isParentLocked = lockedFolders.lockState.some(lockedPath => 
          folderPath.startsWith(lockedPath + '/'));
        
        if (isParentLocked) {
          log(`상위 폴더가 이미 잠겨 있어 ${folderPath} 폴더는 잠그지 않습니다.`, 'info');
          // 상태 변경 없이 성공 응답 (클라이언트 혼란 방지)
          return res.status(200).json({
            success: true,
            message: "상위 폴더가 이미 잠겨 있습니다.",
            path: folderPath,
            action: action,
            status: 'skipped'
          });
        }
        
        const subLockedFolders = lockedFolders.lockState.filter(lockedPath => 
          lockedPath.startsWith(folderPath + '/'));
        
        if (subLockedFolders.length > 0) {
          log(`${folderPath} 폴더 잠금으로 인해 ${subLockedFolders.length}개의 하위 폴더 잠금이 해제됩니다.`, 'info');
          lockedFolders.lockState = lockedFolders.lockState.filter(path => 
            !path.startsWith(folderPath + '/'));
        }
        
        lockedFolders.lockState.push(folderPath);
        changed = true;
        log(`폴더 잠금 적용: ${folderPath}`, 'info');
      } else {
        log(`폴더가 이미 잠겨 있음: ${folderPath}`, 'info');
      }
    } else { // action === 'unlock'
      const initialLength = lockedFolders.lockState.length;
      lockedFolders.lockState = lockedFolders.lockState.filter(path => path !== folderPath);
      if (lockedFolders.lockState.length < initialLength) {
        changed = true;
        log(`폴더 잠금 해제 적용: ${folderPath}`, 'info');
      } else {
        log(`폴더가 잠겨있지 않음: ${folderPath}`, 'info');
      }
    }

    // 변경 사항이 있을 경우 파일 저장 (비동기)
    if (changed) {
      try {
        await fs.promises.writeFile(lockedFoldersPath, JSON.stringify(lockedFolders, null, 2), 'utf8');
        await fs.promises.chmod(lockedFoldersPath, 0o666);
        log('잠긴 폴더 목록 저장 완료.', 'info');
      } catch (writeError) {
        errorLog('잠긴 폴더 목록 저장 오류:', writeError);
        // 파일 저장 실패 시 오류 응답
        return res.status(500).send('잠금 상태 저장 중 오류가 발생했습니다.');
      }
    }

    // 성공 응답
    res.status(200).json({
      success: true,
      message: `폴더가 성공적으로 ${action === 'lock' ? '잠금' : '잠금 해제'}되었습니다.`, 
      path: folderPath,
      action: action,
      status: changed ? 'updated' : 'nochange'
    });

  } catch (error) {
    // 핸들러 자체의 예외 처리
    errorLog('폴더 잠금/해제 API 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 파일 목록 조회 또는 파일 다운로드
app.get('/api/files/*', async (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    let requestPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, requestPath);
    
    logWithIP(`파일 목록/다운로드 요청: ${fullPath}`, req, 'info');

    let stats;
    try {
      // *** 비동기 방식으로 경로 존재 및 정보 확인 ***
      stats = await fs.promises.stat(fullPath);
    } catch (error) {
      // 존재하지 않는 경우 404
      if (error.code === 'ENOENT') {
        errorLogWithIP(`경로를 찾을 수 없습니다: ${fullPath}`, null, req);
        return res.status(404).send('경로를 찾을 수 없습니다.');
      } else {
        // 기타 stat 오류
        errorLogWithIP(`파일/디렉토리 정보 확인 오류: ${fullPath}`, error, req);
        return res.status(500).send('서버 오류가 발생했습니다.');
      }
    }

    // 디렉토리인지 확인
    if (!stats.isDirectory()) {
      // 파일인 경우 처리 (기존 다운로드 로직 유지)
      logWithIP(`파일 다운로드 요청: ${fullPath}`, req, 'info');
      
      // 파일명 추출
      const fileName = path.basename(fullPath);
      // 파일 확장자 추출
      const fileExt = path.extname(fullPath).toLowerCase().substring(1);
      
      // 브라우저에서 직접 볼 수 있는 파일 형식
      const viewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
                            'mp4', 'webm', 'ogg', 'mp3', 'wav', 
                            'pdf', 'txt', 'html', 'htm', 'css', 'js', 'json', 'xml'];
      
      // MIME 타입 설정
      const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'html': 'text/html',
        'htm': 'text/html',
        'css': 'text/css',
        'js': 'text/javascript',
        'json': 'application/json',
        'xml': 'application/xml'
      };
      
      // 직접 볼 수 있는 파일인지 확인
      if (viewableTypes.includes(fileExt)) {
        res.setHeader('Content-Type', mimeTypes[fileExt] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        fs.createReadStream(fullPath).pipe(res); // 스트림 방식은 비동기
      } else {
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.download(fullPath, fileName, (err) => { // res.download도 비동기 처리
          if (err) {
            errorLogWithIP(`파일 다운로드 중 오류: ${fullPath}`, err, req);
          } else {
            logWithIP(`파일 다운로드 완료: ${fullPath}`, req, 'info');
          }
        });
      }
      return;
    }

    // 디렉토리 내용 읽기 (비동기)
    const items = await fs.promises.readdir(fullPath);
    
    // 각 항목의 정보를 비동기적으로 가져오기 (Promise.all 사용)
    const fileItemsPromises = items.map(async (item) => {
      const itemPath = path.join(fullPath, item);
      try {
        const itemStats = await fs.promises.stat(itemPath);
        const isDirectory = itemStats.isDirectory();
        return {
          name: item,
          isFolder: isDirectory,
          size: itemStats.size,
          modifiedTime: itemStats.mtime.toISOString()
        };
      } catch (itemError) {
        // 개별 항목 stat 오류 처리 (예: 권한 문제)
        errorLogWithIP(`항목 정보 확인 오류: ${itemPath}`, itemError, req);
        return null; // 오류 발생 시 null 반환 또는 다른 방식으로 처리
      }
    });

    // 모든 Promise가 완료될 때까지 기다린 후, null이 아닌 항목만 필터링
    const fileItems = (await Promise.all(fileItemsPromises)).filter(item => item !== null);

    logWithIP(`파일 목록 반환: ${fileItems.length}개 항목`, req, 'info');
    res.json(fileItems);

  } catch (error) {
    // 핸들러 전체의 오류 처리
    errorLogWithIP('파일 목록 API 오류:', error, req);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 새 폴더 생성 (시스템 명령어로 변경)
app.post('/api/files/*', (req, res) => {
  try {
    const folderPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, folderPath);
    const escapedFullPath = escapeShellArg(fullPath); // 경로 이스케이프

    logWithIP(`폴더 생성 요청 (명령어 사용): ${fullPath}`, req, 'info');

    // 이미 존재하는지 확인 (fs.existsSync는 유지)
    if (fs.existsSync(fullPath)) {
      errorLogWithIP(`이미 존재하는 폴더: ${fullPath}`, null, req);
      return res.status(409).send('이미 존재하는 이름입니다.');
    }

    // 폴더 생성 명령어 실행 (mkdir -p && chmod 777)
    const command = `mkdir -p ${escapedFullPath} && chmod 777 ${escapedFullPath}`;
    logWithIP(`폴더 생성 명령어 실행: ${command}`, req, 'debug');
    try {
      execSync(command); // 동기 실행
      logWithIP(`폴더 생성 완료: ${fullPath}`, req, 'info');
      res.status(201).send('폴더가 생성되었습니다.');
    } catch (execError) {
      errorLogWithIP(`폴더 생성 명령어 오류: ${command}`, execError, req);
      res.status(500).send('폴더 생성 중 오류가 발생했습니다.');
    }

  } catch (error) {
    // 핸들러 자체 오류 (예: decodeURIComponent 오류)
    errorLogWithIP('폴더 생성 API 핸들러 오류:', error, req);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 파일/폴더 이름 변경 또는 이동 (시스템 명령어로 변경, 비동기 유지)
app.put('/api/files/*', express.json(), async (req, res) => {
  try {
    const oldPath = decodeURIComponent(req.params[0] || '');
    const { newName, targetPath, overwrite } = req.body;

    logWithIP(`[Move/Rename Request - CMD] '${oldPath}' -> '${newName}' (대상: ${targetPath !== undefined ? targetPath : '동일 경로'})`, req, 'minimal');
    log(`이름 변경/이동 요청 (명령어 사용): ${oldPath} -> ${newName}, 대상 경로: ${targetPath !== undefined ? targetPath : '현재 경로'}, 덮어쓰기: ${overwrite ? '예' : '아니오'}`, req, 'info');

    if (!newName) {
      errorLogWithIP('새 이름이 제공되지 않음', null, req);
      return res.status(400).send('새 이름이 제공되지 않았습니다.');
    }

    const fullOldPath = path.join(ROOT_DIRECTORY, oldPath);
    const escapedFullOldPath = escapeShellArg(fullOldPath); // 경로 이스케이프

    // 원본 존재 확인 (fs.promises.access 유지)
    try {
      await fs.promises.access(fullOldPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        errorLogWithIP(`원본 파일/폴더를 찾을 수 없음: ${fullOldPath}`, null, req);
        return res.status(404).send(`파일 또는 폴더를 찾을 수 없습니다: ${oldPath}`);
      } else {
        errorLogWithIP(`원본 접근 오류: ${fullOldPath}`, error, req);
        return res.status(500).send('서버 오류가 발생했습니다.');
      }
    }

    // 잠금 폴더 목록 로드 (기존 로직 유지)
    let lockedFolders = [];
    // ... (잠금 폴더 로드 로직) ...

    // 원본 경로 잠금 확인 (기존 로직 유지)
    const isSourceLocked = lockedFolders.some(/* ... */);
    if (isSourceLocked) {
        errorLogWithIP(`잠긴 항목 이동/이름 변경 시도: ${fullOldPath}`, null, req);
        return res.status(403).send('잠긴 폴더 또는 그 하위 항목은 이동하거나 이름을 변경할 수 없습니다.');
    }


    // 타겟 경로 설정
    const targetDir = targetPath !== undefined ? targetPath : path.dirname(oldPath);
    const fullTargetPath = path.join(ROOT_DIRECTORY, targetDir);
    const fullNewPath = path.join(fullTargetPath, newName);
    const escapedFullTargetPath = escapeShellArg(fullTargetPath); // 경로 이스케이프
    const escapedFullNewPath = escapeShellArg(fullNewPath);     // 경로 이스케이프

    logWithIP(`전체 경로 처리 (명령어 사용): ${fullOldPath} -> ${fullNewPath}`, 'debug');

    // 원본과 대상이 같은 경우 무시 (기존 로직 유지)
    if (fullOldPath === fullNewPath) {
      logWithIP(`동일한 경로로의 이동/변경 무시: ${fullOldPath}`, 'debug');
      return res.status(200).send('이름 변경/이동이 완료되었습니다.');
    }
    
    // 대상 경로가 잠긴 폴더의 하위인지 확인 (기존 로직 유지)
    const isTargetLocked = lockedFolders.some(/* ... */);
    if (isTargetLocked) {
        errorLogWithIP(`잠긴 폴더 내부로 이동 시도: ${fullNewPath}`, null, req);
        return res.status(403).send('잠긴 폴더 내부로 이동할 수 없습니다.');
    }

    // 대상 디렉토리 생성 (mkdir -p && chmod 777 사용)
    try {
      const mkdirCommand = `mkdir -p ${escapedFullTargetPath} && chmod 777 ${escapedFullTargetPath}`;
      log(`대상 디렉토리 생성 명령어 실행: ${mkdirCommand}`, 'debug');
      await exec(mkdirCommand); // 비동기 실행
      log(`대상 디렉토리 확인/생성 완료: ${fullTargetPath}`, 'debug');
    } catch (mkdirError) {
      errorLogWithIP(`대상 디렉토리 생성 명령어 오류: ${fullTargetPath}`, mkdirError, req);
      // 오류 응답 전에 stderr 내용도 로깅하면 좋음
      if (mkdirError.stderr) {
          errorLogWithIP(`mkdir stderr: ${mkdirError.stderr}`, null, req);
      }
      return res.status(500).send('대상 폴더 생성 중 오류가 발생했습니다.');
    }

    // 대상 경로에 이미 존재하는 경우 처리 (rm -rf 사용)
    try {
      // 존재 여부 확인 (fs.promises.stat 유지)
      await fs.promises.stat(fullNewPath);

      // 존재하면 덮어쓰기 옵션 확인
      if (!overwrite) {
        errorLogWithIP(`대상 경로에 파일/폴더가 이미 존재함 (덮어쓰기 비활성): ${fullNewPath}`, null, req);
        return res.status(409).send('같은 이름의 파일이나 폴더가 이미 대상 경로에 존재합니다.');
      }

      // 덮어쓰기 실행 - 기존 항목 삭제 (rm -rf 사용)
      logWithIP(`대상 경로에 존재하는 항목 덮어쓰기 시도 (rm 사용): ${fullNewPath}`, 'debug');
      const rmCommand = `rm -rf ${escapedFullNewPath}`;
      log(`기존 항목 삭제 명령어 실행: ${rmCommand}`, 'debug');
      try {
        await exec(rmCommand); // 비동기 실행
        logWithIP(`기존 항목 삭제 완료 (rm 사용): ${fullNewPath}`, 'debug');
      } catch (rmError) {
        errorLogWithIP(`기존 항목 삭제 명령어 오류 (덮어쓰기): ${fullNewPath}`, rmError, req);
        if (rmError.stderr) {
            errorLogWithIP(`rm stderr: ${rmError.stderr}`, null, req);
        }
        return res.status(500).send('기존 파일/폴더 삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // stat 오류 (존재하지 않는 경우가 아님) - 예상치 못한 오류
        errorLogWithIP(`대상 경로 상태 확인 오류: ${fullNewPath}`, error, req);
        return res.status(500).send('대상 경로 확인 중 오류가 발생했습니다.');
      }
      // ENOENT는 정상 (파일/폴더 없음)
    }

    // 최종 이름 변경/이동 실행 (mv 사용)
    const mvCommand = `mv ${escapedFullOldPath} ${escapedFullNewPath}`;
    log(`이름 변경/이동 명령어 실행: ${mvCommand}`, 'debug');
    try {
      await exec(mvCommand); // 비동기 실행
      logWithIP(`이름 변경/이동 완료 (mv 사용): ${fullOldPath} -> ${fullNewPath}`, 'info');
      res.status(200).send('이름 변경/이동이 완료되었습니다.');
    } catch (mvError) {
      errorLogWithIP(`이름 변경/이동 명령어 오류: ${mvCommand}`, mvError, req);
      if (mvError.stderr) {
          errorLogWithIP(`mv stderr: ${mvError.stderr}`, null, req);
      }
      res.status(500).send('파일/폴더 이동 또는 이름 변경 중 오류가 발생했습니다.');
    }

  } catch (error) {
    // 핸들러 자체의 예외 처리
    errorLogWithIP('이름 변경/이동 API 오류:', error, req);
    res.status(500).send(`서버 오류가 발생했습니다: ${error.message}`);
  }
});

// 파일/폴더 삭제 (백그라운드 처리 - 이 부분은 변경 없음, 워커에서 rm 사용)
app.delete('/api/files/*', async (req, res) => {
  try {
    const itemPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, itemPath);

    logWithIP(`[Delete Request] '${itemPath}' 삭제 요청 (백그라운드 처리)`, req, 'info');

    // --- 기본 검사 (동기 또는 비동기 유지) ---
    try {
      // 존재 여부만 확인 (타입은 워커에서 처리)
      await fs.promises.access(fullPath, fs.constants.F_OK);

      // --- 백그라운드 작업 시작 ---
      logWithIP(`백그라운드 삭제 작업 시작 요청: ${fullPath}`, req, 'info');

      const workerScript = path.join(__dirname, 'backgroundWorker.js');
      const worker = fork(workerScript, ['delete', fullPath], {
        stdio: 'pipe'  // 변경: 워커 출력을 pipe로 연결 (필요시 로깅 가능)
      });
      activeWorkers.add(worker); // 활성 워커 Set에 추가
      log(`[Worker Management] 워커 생성됨 (PID: ${worker.pid}, 작업: delete). 활성 워커 수: ${activeWorkers.size}`, 'debug');

      worker.stdout.on('data', (data) => {
        log(`[Worker Output - delete:${worker.pid}] ${data.toString().trim()}`, 'debug');
      });
      worker.stderr.on('data', (data) => {
        errorLog(`[Worker Error - delete:${worker.pid}] ${data.toString().trim()}`);
      });

      worker.on('error', (err) => {
        errorLogWithIP(`백그라운드 워커 실행 오류 (delete): ${fullPath}`, err, req);
        activeWorkers.delete(worker); // 오류 발생 시 Set에서 제거
        log(`[Worker Management] 워커 오류로 제거 (PID: ${worker.pid}). 활성 워커 수: ${activeWorkers.size}`, 'debug');
      });

      worker.on('exit', (code, signal) => {
        activeWorkers.delete(worker); // 정상/비정상 종료 시 Set에서 제거
        if (signal) {
          log(`[Worker Management] 워커가 신호 ${signal}로 종료됨 (PID: ${worker.pid}). 활성 워커 수: ${activeWorkers.size}`, 'info');
        } else {
          log(`[Worker Management] 워커 종료됨 (PID: ${worker.pid}, 코드: ${code}). 활성 워커 수: ${activeWorkers.size}`, 'debug');
        }
      });
      
      // --- 즉시 응답 (202 Accepted) ---
      res.status(202).send('삭제 작업이 백그라운드에서 시작되었습니다.');

    } catch (error) {
      // 파일/폴더가 없는 경우 등 사전 검사 오류
      if (error.code === 'ENOENT') {
        errorLogWithIP(`삭제 대상 없음 (사전 검사): ${fullPath}`, error, req);
        return res.status(404).send('파일 또는 폴더를 찾을 수 없습니다.');
      }
      // 기타 사전 검사 오류
      errorLogWithIP(`삭제 요청 처리 중 오류 (사전 검사): ${fullPath}`, error, req);
      return res.status(500).send(`서버 오류가 발생했습니다: ${error.message}`);
    }
    // --- 기본 검사 종료 ---

  } catch (error) {
    // 핸들러 자체의 오류 처리
    errorLogWithIP('삭제 API 핸들러 오류:', error, req);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 새 폴더 생성 (비동기화)
app.post('/api/folders', express.json(), async (req, res) => { // *** async 추가 ***
  const { folderPath, folderName } = req.body;
  if (!folderName) {
    return res.status(400).send('폴더 이름이 제공되지 않았습니다.');
  }

  // 폴더 이름 유효성 검사 (여기서는 간단히, 필요시 강화)
  if (/[/\\:*?"<>|]/g.test(folderName)) {
      return res.status(400).send('폴더 이름에 사용할 수 없는 문자가 포함되어 있습니다.');
  }

  const relativeFolderPath = folderPath || ''; // 기본값은 루트
  const fullPath = path.join(ROOT_DIRECTORY, relativeFolderPath, folderName);

  logWithIP(`[Folder Create] '${relativeFolderPath}/${folderName}' 생성 요청`, req, 'minimal');
  log(`새 폴더 생성 요청: ${fullPath}`, 'info');

  try {
    // *** 폴더 존재 확인 (비동기) ***
    try {
      await fs.promises.access(fullPath);
      // 폴더가 이미 존재하면 오류 반환 (access 성공 시)
      errorLogWithIP(`폴더가 이미 존재함: ${fullPath}`, null, req);
      return res.status(409).send('이미 존재하는 폴더 이름입니다.');
    } catch (error) {
      // 접근 오류(ENOENT) 발생 시 폴더가 없는 것이므로 정상 진행
      if (error.code !== 'ENOENT') {
        // ENOENT 외 다른 접근 오류는 서버 오류로 처리
        errorLogWithIP('폴더 존재 확인 중 접근 오류 발생', error, req);
        return res.status(500).send('폴더 생성 중 오류가 발생했습니다.');
      }
      // ENOENT는 정상, 계속 진행
    }

    // *** 폴더 생성 및 권한 설정 (비동기) ***
    await fs.promises.mkdir(fullPath, { recursive: true }); // recursive는 상위 경로 자동 생성
    await fs.promises.chmod(fullPath, 0o777);
    log(`폴더 생성 완료 및 권한 설정: ${fullPath}`, 'info');

    res.status(201).send('폴더가 성공적으로 생성되었습니다.');

  } catch (error) { // 폴더 생성/권한 설정 중 발생한 오류 또는 예기치 못한 오류 처리
    errorLogWithIP(`폴더 생성 중 오류 발생: ${fullPath}`, error, req);
    res.status(500).send('폴더 생성 중 오류가 발생했습니다.');
  }
});
// 로그 레벨 변경 API
app.put('/api/log-level', (req, res) => {
  const { level } = req.body;
  if (level && LOG_LEVELS.hasOwnProperty(level)) {
    setLogLevel(level);
    res.status(200).json({ success: true, message: `Log level set to ${level}` });
  } else {
    errorLogWithIP(`Invalid log level requested: ${level}`, null, req);
    res.status(400).json({ success: false, error: 'Invalid log level provided. Use minimal, info, or debug.' });
  }
});

// --- 서버 종료 처리 (SIGTERM 핸들러) ---
process.on('SIGTERM', () => {
  log('SIGTERM 신호 수신. 서버를 종료합니다.', 'minimal');

  // 활성 워커 프로세스들에게 종료 신호 보내기
  log(`활성 워커 ${activeWorkers.size}개에게 종료 신호를 보냅니다...`, 'info');
  activeWorkers.forEach(worker => {
    try {
      // SIGKILL을 보내 즉시 종료 시도
      if (!worker.killed) { // 이미 종료되지 않은 경우에만 시도
        worker.kill('SIGKILL'); 
        log(`워커 (PID: ${worker.pid})에게 SIGKILL 전송됨.`, 'debug');
      }
    } catch (err) {
      errorLog(`워커 (PID: ${worker.pid})에게 종료 신호 전송 중 오류:`, err);
    }
  });

  // 필요한 경우 추가적인 정리 작업 수행 (예: DB 연결 닫기 등)

  // 잠시 대기 후 프로세스 종료 (워커 종료 시간을 약간 확보)
  setTimeout(() => {
    log('서버 프로세스 종료.', 'minimal');
    process.exit(0); // 정상 종료
  }, 1000); // 1초 대기 (필요에 따라 조정)
});

// --- 서버 시작 로직 수정 (setupLogStreams 호출 제거) ---
async function startServer() {
  await initializeDirectories(); // 디렉토리 초기화 및 로그 스트림 설정 완료 대기
  // setupLogStreams(); // 여기서 호출 제거

  // 서버 리스닝 시작
  app.listen(PORT, () => {
    log(`서버가 ${PORT} 포트에서 실행 중입니다. 로그 레벨: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLogLevel)}`, 'minimal');
    log(`WebDAV 서버: http://localhost:${PORT}/webdav`, 'info');
  });
}

startServer(); // 서버 시작 함수 호출