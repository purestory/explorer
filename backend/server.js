const express = require('express');
const webdav = require('webdav-server').v2;
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { execSync } = require('child_process');
const { fork } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3333;

// 로그 디렉토리 확인 및 생성
const LOGS_DIRECTORY = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIRECTORY)) {
  fs.mkdirSync(LOGS_DIRECTORY, { recursive: true });
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

// 로그 파일 스트림
const logFile = fs.createWriteStream(path.join(LOGS_DIRECTORY, 'server.log'), { flags: 'a' });
const errorLogFile = fs.createWriteStream(path.join(LOGS_DIRECTORY, 'error.log'), { flags: 'a' });

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

function errorLog(message, error) { // 오류 로그는 항상 기록
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

  const logMessage = `${timestamp} - ERROR: ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;
  errorLogFile.write(logMessage);
  console.error(message, error);
}

function errorLogWithIP(message, error, req) { // 오류 로그는 항상 기록
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

  const logMessage = `${timestamp} - ERROR: [IP: ${ip}] ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;
  errorLogFile.write(logMessage);
  console.error(`[IP: ${ip}] ${message}`, error);
}

// 최대 저장 용량 설정 (100GB)
const MAX_STORAGE_SIZE = 100 * 1024 * 1024 * 1024; // 100GB in bytes

// 최대 파일명/경로 길이 제한 설정 (전역으로 이동)
const MAX_FILENAME_BYTES = 229;
const MAX_PATH_BYTES = 3800; // 일반적인 최대값보다 안전한 값으로 설정

// 디스크 사용량 확인 함수
function getDiskUsage() {
  try {
    const output = execSync(`du -sb ${ROOT_DIRECTORY}`).toString();
    const usedBytes = parseInt(output.split('\t')[0]);
    return {
      used: usedBytes,
      total: MAX_STORAGE_SIZE,
      available: MAX_STORAGE_SIZE - usedBytes,
      percent: Math.round((usedBytes / MAX_STORAGE_SIZE) * 100)
    };
  } catch (error) {
    errorLog('디스크 사용량 확인 오류:', error);
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

// 파일 저장소 설정
const ROOT_DIRECTORY = path.join(__dirname, 'share-folder');
if (!fs.existsSync(ROOT_DIRECTORY)) {
  fs.mkdirSync(ROOT_DIRECTORY, { recursive: true });
  log(`루트 디렉토리 생성: ${ROOT_DIRECTORY}`, 'info');
}

// 권한 설정
fs.chmodSync(ROOT_DIRECTORY, 0o777);
log(`루트 디렉토리 권한 설정: ${ROOT_DIRECTORY}`, 'info');

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

// 임시 업로드 디렉토리 설정
const TMP_UPLOAD_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP_UPLOAD_DIR)) {
  fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });
}

// Multer 설정 (Disk Storage 사용 - 요청별 임시 폴더 생성)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 각 요청별 고유 임시 디렉토리 생성
    if (!req.uniqueTmpDir) {
      const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
      req.uniqueTmpDir = path.join(TMP_UPLOAD_DIR, uniqueId);
      try {
        fs.mkdirSync(req.uniqueTmpDir, { recursive: true });
        logWithIP(`[Multer] 요청별 임시 디렉토리 생성: ${req.uniqueTmpDir}`, req);
      } catch (mkdirError) {
        errorLogWithIP('[Multer] 임시 디렉토리 생성 오류', mkdirError, req);
        return cb(mkdirError);
      }
    }
    cb(null, req.uniqueTmpDir);
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

// 파일 업로드 API 수정 (diskStorage 로직으로 복구)
app.post('/api/upload', uploadMiddleware.any(), async (req, res) => {
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

  // 4. 파일 처리 루프 (이전 상태로 복구)
  for (const fileInfo of fileInfoArray) {
    logWithIP(`[Upload Loop] 처리 시작: ${fileInfo.originalName}, 상대 경로: ${fileInfo.relativePath}`, req, 'debug');

    // 파일 처리 루프: 인덱스 기반으로 파일 찾기
    const expectedFieldName = `file_${fileInfo.index}`;
    const file = req.files.find(f => f.fieldname === expectedFieldName);

    // 로그 추가: 찾은 파일 정보 확인
    if (file) {
      logWithIP(`[File Index Match] Found file for index ${fileInfo.index}: fieldname='${file.fieldname}', originalname='${file.originalname}' (may be corrupted)`, req, 'debug');
    } else {
      logWithIP(`[File Index Match] File NOT found for index ${fileInfo.index} (expected fieldname: ${expectedFieldName})`, req, 'debug');
    }

    if (!file || !file.path) {
        // 오류 메시지에 정규화된 이름도 포함하여 디버깅 용이성 향상 (선택 사항)
        errorLogWithIP(`[Upload Loop Error] 업로드된 파일 목록에서 정보를 찾을 수 없음: Original='${fileInfo.originalName}', Index=${fileInfo.index}`, null, req);
        errors.push(`파일 ${fileInfo.originalName} (Index: ${fileInfo.index})의 정보를 찾을 수 없거나 임시 파일이 없습니다.`, 'debug');
        continue; // 다음 파일 처리로 넘어감
    }
    logWithIP(`[Upload Loop] 파일 객체 찾음: ${fileInfo.originalName} (Index: ${fileInfo.index}), 임시 경로: ${file.path}`, req, 'debug');

    try {
      let relativeFilePath = fileInfo.relativePath;
      const originalFileName = path.basename(relativeFilePath);
      let finalFileName = originalFileName;
      logWithIP(`[Upload Try] 파일명 처리 시작: Original='${originalFileName}', Relative='${relativeFilePath}'`, req, 'debug');

      if (Buffer.byteLength(originalFileName) > MAX_FILENAME_BYTES) {
          finalFileName = truncateFileName(originalFileName);
          const dirName = path.dirname(relativeFilePath);
          relativeFilePath = dirName === '.' ? finalFileName : path.join(dirName, finalFileName);
          logWithIP(`[Upload Try] 파일명 길이 제한 적용됨: Final='${finalFileName}', Relative='${relativeFilePath}'`, req, 'debug');
      }

      let destinationPath = path.join(rootUploadDir, relativeFilePath);
      logWithIP(`[Upload Try] 초기 목적지 경로 계산됨: ${destinationPath}`, req, 'debug');

      const pathResult = checkAndTruncatePath(destinationPath);
      if (pathResult.truncated) {
          destinationPath = pathResult.path;
          relativeFilePath = destinationPath.substring(rootUploadDir.length).replace(/^\\+|^\//, '');
          logWithIP(`[Upload Try] 전체 경로 길이 제한 적용됨: Final Dest='${destinationPath}', Relative='${relativeFilePath}'`, req, 'debug');
      }

      const destinationDir = path.dirname(destinationPath);
      logWithIP(`[Upload Try] 최종 목적지 디렉토리: ${destinationDir}`, req, 'debug');

      if (!fs.existsSync(destinationDir)) {
          fs.mkdirSync(destinationDir, { recursive: true });
          fs.chmodSync(destinationDir, 0o777);
          logWithIP(`[Upload Try] 하위 디렉토리 생성됨: ${destinationDir}`, req, 'debug');
      }

      logWithIP(`[Upload Try] 최종 저장 경로 확인: ${destinationPath}`, req, 'debug');

      fs.copyFileSync(file.path, destinationPath);
      fs.chmodSync(destinationPath, 0o666);
      logWithIP(`[Upload Try] 파일 저장 완료 (Disk): ${destinationPath}`, req, 'debug');

      processedFiles.push({
        name: path.basename(destinationPath),
        originalName: fileInfo.originalName,
        relativePath: relativeFilePath,
        size: file.size,
        path: baseUploadPath,
        mimetype: file.mimetype,
        fullPath: destinationPath
      });

    } catch (writeError) {
        errorLogWithIP(`[Upload Catch Error] 파일 저장 중 오류 발생: ${fileInfo.relativePath}`, writeError, req);
        errors.push(`파일 ${fileInfo.relativePath} 저장 중 오류 발생: ${writeError.message}`, 'debug');
    }
    logWithIP(`[Upload Loop] 처리 완료: ${fileInfo.originalName}`, req, 'debug');
  } // end for loop

  // 5. 요청별 임시 폴더 삭제 (async/await 사용)
  if (req.uniqueTmpDir) {
    const tempDirToDelete = req.uniqueTmpDir;
    logWithIP(`[Upload Cleanup] 임시 폴더 삭제 시도: ${tempDirToDelete}`, req, 'debug');
    try {
      // await를 사용하여 삭제 완료를 기다림
      await fs.promises.rm(tempDirToDelete, { recursive: true, force: true });
      logWithIP(`[Upload Cleanup] 임시 폴더 삭제 완료: ${tempDirToDelete}`, req, 'debug');
    } catch (cleanupError) {
      // ENOENT 오류는 무시
      if (cleanupError.code !== 'ENOENT') {
        errorLogWithIP(`임시 폴더 삭제 중 오류 발생: ${tempDirToDelete}`, cleanupError, req);
        // 참고: 여기서 클라이언트 응답을 변경하지는 않음.
      } else {
        logWithIP(`[Upload Cleanup] 임시 폴더 이미 없거나 삭제됨: ${tempDirToDelete}`, req, 'debug');
      }
    }
  } else {
    logWithIP(`[Upload Cleanup] 삭제할 임시 폴더 정보 없음`, req, 'debug');
  }

  // 6. 최종 응답 전송 (이전 상태로 복구)
  if (errors.length > 0) {
    logWithIP(`파일 업로드 중 ${errors.length}개의 오류 발생`, req, 'info');
    res.status(207).json({ // Multi-Status 응답
      message: `일부 파일 업로드 중 오류 발생 (${processedFiles.length}개 성공, ${errors.length}개 실패)`,
      processedFiles: processedFiles,
      errors: errors
    });
  } else {
    logWithIP(`${processedFiles.length}개 파일 업로드 성공`, req, 'info');
    res.status(201).json({
      message: '파일 업로드 성공',
      files: processedFiles
    });
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
app.get('/api/disk-usage', (req, res) => {
  try {
    const diskUsage = getDiskUsage();
    log(`디스크 사용량 조회: ${formatFileSize(diskUsage.used)} / ${formatFileSize(diskUsage.total)} (${diskUsage.percent}%)`, 'info');
    res.json(diskUsage);
  } catch (error) {
    errorLog('디스크 사용량 조회 오류:', error);
    res.status(500).json({
      error: '디스크 사용량 조회 오류',
      message: '디스크 사용량 조회 중 오류가 발생했습니다.'
    });
  }
});

// 파일 압축 API
app.post('/api/compress', bodyParser.json(), (req, res) => {
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
    
    // 압축 파일 전체 경로
    const basePath = targetPath ? path.join(ROOT_DIRECTORY, targetPath) : ROOT_DIRECTORY;
    const zipFilePath = path.join(basePath, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`);
    
    // 중복 확인
    if (fs.existsSync(zipFilePath)) {
      return res.status(409).json({ error: '같은 이름의 압축 파일이 이미 존재합니다.' });
    }
    
    // zip 명령어 구성 - 압축률 0 옵션 추가 (-0)
    let zipCommand = `cd "${ROOT_DIRECTORY}" && zip -0 -r "${zipFilePath}"`;
    
    // 파일 경로 추가
    files.forEach(file => {
      const filePath = targetPath ? `${targetPath}/${file}` : file;
      const fullPath = path.join(ROOT_DIRECTORY, filePath);
      
      // 파일/폴더 존재 확인
      if (fs.existsSync(fullPath)) {
        // 상대 경로 추출 (ROOT_DIRECTORY 기준)
        const relativePath = path.relative(ROOT_DIRECTORY, fullPath);
        zipCommand += ` "${relativePath}"`;
      }
    });
    
    // 압축 실행
    log(`실행 명령어: ${zipCommand}`, 'debug');
    execSync(zipCommand);
    
    // 압축 파일 권한 설정
    fs.chmodSync(zipFilePath, 0o666);
    
    log(`압축 완료: ${zipFilePath}`, 'info');
    res.status(200).json({ 
      success: true, 
      message: '압축이 완료되었습니다.',
      zipFile: path.basename(zipFilePath),
      zipPath: targetPath || ''
    });
  } catch (error) {
    errorLog('압축 오류:', error);
    res.status(500).json({ error: '파일 압축 중 오류가 발생했습니다.', message: error.message });
  }
});

// 폴더 잠금 상태 조회 API
app.get('/api/lock-status', (req, res) => {
  try {
    // lockedFolders.json 파일에서 잠긴 폴더 목록 로드
    const lockedFoldersPath = path.join(__dirname, 'lockedFolders.json');
    let lockState = [];
    
    if (fs.existsSync(lockedFoldersPath)) {
      try {
        lockState = JSON.parse(fs.readFileSync(lockedFoldersPath, 'utf8')).lockState || [];
      } catch (error) {
        errorLog('잠긴 폴더 목록 파싱 오류:', error);
      }
    } else {
      // 파일이 없으면 빈 배열로 초기화하고 파일 생성
      fs.writeFileSync(lockedFoldersPath, JSON.stringify({ lockState: [] }), 'utf8');
    }
    
    log(`잠금 상태 조회: ${lockState.length}개 폴더 잠김`, 'info');
    res.status(200).json({ lockState });
  } catch (error) {
    errorLog('잠금 상태 조회 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 폴더 잠금/해제 API
app.post('/api/lock/:path(*)', (req, res) => {
  try {
    const folderPath = decodeURIComponent(req.params.path || '');
    const action = req.body.action || 'lock'; // 'lock' 또는 'unlock'
    const fullPath = path.join(ROOT_DIRECTORY, folderPath);
    
    logWithIP(`[Lock Request] '${folderPath}' ${action === 'lock' ? '잠금' : '잠금 해제'} 요청`, req, 'minimal');

    log(`폴더 ${action === 'lock' ? '잠금' : '잠금 해제'} 요청: ${fullPath}`, 'info');

    // 폴더가 존재하는지 확인
    if (!fs.existsSync(fullPath)) {
      errorLogWithIP(`폴더를 찾을 수 없음: ${fullPath}`, null, req);
      return res.status(404).send('폴더를 찾을 수 없습니다.');
    }

    // 디렉토리인지 확인
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      errorLogWithIP(`잠금 대상이 폴더가 아님: ${fullPath}`);
      return res.status(400).send('폴더만 잠금/해제할 수 있습니다.');
    }

    // lockedFolders.json 파일에서 잠긴 폴더 목록 로드
    const lockedFoldersPath = path.join(__dirname, 'lockedFolders.json');
    let lockedFolders = { lockState: [] };
    
    if (fs.existsSync(lockedFoldersPath)) {
      try {
        lockedFolders = JSON.parse(fs.readFileSync(lockedFoldersPath, 'utf8'));
        if (!lockedFolders.lockState) {
          lockedFolders.lockState = [];
        }
      } catch (error) {
        errorLog('잠긴 폴더 목록 파싱 오류:', error);
        lockedFolders = { lockState: [] };
      }
    }

    // 잠금 또는 해제 처리
    if (action === 'lock') {
      // 이미 잠겨있는지 확인
      if (!lockedFolders.lockState.includes(folderPath)) {
        // 상위 경로가 이미 잠겨 있는지 확인
        const isParentLocked = lockedFolders.lockState.some(lockedPath => 
          folderPath.startsWith(lockedPath + '/'));
        
        if (isParentLocked) {
          log(`상위 폴더가 이미 잠겨 있어 ${folderPath} 폴더는 잠그지 않습니다.`, 'info');
          return res.status(200).json({
            success: true,
            message: "상위 폴더가 이미 잠겨 있습니다.",
            path: folderPath,
            action: action,
            status: 'skipped'
          });
        }
        
        // 현재 폴더의 하위 폴더 중 이미 잠긴 폴더가 있는지 확인하고 해제
        const subLockedFolders = lockedFolders.lockState.filter(lockedPath => 
          lockedPath.startsWith(folderPath + '/'));
        
        if (subLockedFolders.length > 0) {
          log(`${folderPath} 폴더 잠금으로 인해 ${subLockedFolders.length}개의 하위 폴더 잠금이 해제됩니다.`, 'info');
          // 하위 폴더는 잠금 해제
          lockedFolders.lockState = lockedFolders.lockState.filter(path => 
            !path.startsWith(folderPath + '/'));
        }
        
        // 현재 폴더 잠금
        lockedFolders.lockState.push(folderPath);
        log(`폴더 잠금 완료: ${folderPath}`, 'info');
      } else {
        log(`폴더가 이미 잠겨 있음: ${folderPath}`, 'info');
      }
    } else if (action === 'unlock') {
      // 잠금 해제
      lockedFolders.lockState = lockedFolders.lockState.filter(path => path !== folderPath);
      log(`폴더 잠금 해제 완료: ${folderPath}`, 'info');
    }

    // 변경된 목록 저장
    fs.writeFileSync(lockedFoldersPath, JSON.stringify(lockedFolders, null, 2), 'utf8');
    fs.chmodSync(lockedFoldersPath, 0o666); // 권한 설정

    res.status(200).json({
      success: true,
      message: `폴더가 ${action === 'lock' ? '잠겼습니다' : '잠금 해제되었습니다'}`,
      path: folderPath,
      action: action
    });
  } catch (error) {
    errorLog(`폴더 ${req.body.action === 'lock' ? '잠금' : '잠금 해제'} 오류:`, error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// API 라우트 설정 추가
// 파일 목록 가져오기
app.get('/api/files/*', async (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    let requestPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, requestPath);
    
    logWithIP(`파일 목록 요청: ${fullPath}`, req, 'info');

    // 경로가 존재하는지 확인
    if (!fs.existsSync(fullPath)) {
      errorLogWithIP(`경로를 찾을 수 없습니다: ${fullPath}`, null, req);
      return res.status(404).send('경로를 찾을 수 없습니다.');
    }

    // 디렉토리인지 확인
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      // 파일인 경우 처리
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
        // Content-Type 설정
        res.setHeader('Content-Type', mimeTypes[fileExt] || 'application/octet-stream');
        // 인라인 표시 설정 (브라우저에서 직접 열기)
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        // 파일 스트림 전송
        fs.createReadStream(fullPath).pipe(res);
      } else {
        // 일반 다운로드 파일
        // Content-Disposition 헤더에 UTF-8로 인코딩된 파일명 설정
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.download(fullPath, fileName, (err) => {
          if (err) {
            errorLogWithIP(`파일 다운로드 중 오류: ${fullPath}`, err, req);
          } else {
            logWithIP(`파일 다운로드 완료: ${fullPath}`, req, 'info');
          }
        });
      }
      return;
    }

    // 디렉토리 내용 읽기
    const items = fs.readdirSync(fullPath);
    const fileItems = items.map(item => {
      const itemPath = path.join(fullPath, item);
      const itemStats = fs.statSync(itemPath);
      const isDirectory = itemStats.isDirectory();

      return {
        name: item,
        isFolder: isDirectory,
        size: itemStats.size,
        modifiedTime: itemStats.mtime.toISOString()
      };
    });

    logWithIP(`파일 목록 반환: ${fileItems.length}개 항목`, req, 'info');
    res.json(fileItems);
  } catch (error) {
    errorLogWithIP('파일 목록 오류:', error, req);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 새 폴더 생성
app.post('/api/files/*', (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    const folderPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, folderPath);
    
    logWithIP(`폴더 생성 요청: ${fullPath}`, req, 'info');

    // 이미 존재하는지 확인
    if (fs.existsSync(fullPath)) {
      errorLogWithIP(`이미 존재하는 폴더: ${fullPath}`, null, req);
      return res.status(409).send('이미 존재하는 이름입니다.');
    }

    // 폴더 생성
    fs.mkdirSync(fullPath, { recursive: true });
    fs.chmodSync(fullPath, 0o777);
    
    logWithIP(`폴더 생성 완료: ${fullPath}`, req, 'info');
    res.status(201).send('폴더가 생성되었습니다.');
  } catch (error) {
    errorLogWithIP('폴더 생성 오류:', error, req);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 파일/폴더 이름 변경 또는 이동
app.put('/api/files/*', (req, res) => {
  try {
    const oldPath = decodeURIComponent(req.params[0] || '');
    const { newName, targetPath, overwrite } = req.body;
    
    logWithIP(`[Move/Rename Request] '${oldPath}' -> '${newName}' (대상: ${targetPath !== undefined ? targetPath : '동일 경로'})`, req, 'minimal');

    logWithIP(`이름 변경/이동 요청: ${oldPath} -> ${newName}, 대상 경로: ${targetPath !== undefined ? targetPath : '현재 경로'}, 덮어쓰기: ${overwrite ? '예' : '아니오'}`, req, 'info');
    
    if (!newName) {
      errorLogWithIP('새 이름이 제공되지 않음', null, req);
      return res.status(400).send('새 이름이 제공되지 않았습니다.');
    }

    const fullOldPath = path.join(ROOT_DIRECTORY, oldPath);
    
    // 원본이 존재하는지 확인
    if (!fs.existsSync(fullOldPath)) {
      errorLogWithIP(`원본 파일/폴더를 찾을 수 없음: ${fullOldPath}`, null, req);
      return res.status(404).send(`파일 또는 폴더를 찾을 수 없습니다: ${oldPath}`);
    }

    // lockedFolders.json 파일에서 잠긴 폴더 목록 로드
    let lockedFolders = [];
    const lockedFoldersPath = path.join(__dirname, 'lockedFolders.json');
    if (fs.existsSync(lockedFoldersPath)) {
      try {
        lockedFolders = JSON.parse(fs.readFileSync(lockedFoldersPath, 'utf8')).lockState || [];
      } catch (e) {
        errorLogWithIP('잠긴 폴더 목록 로드 오류:', e, req);
        lockedFolders = []; // 오류 발생 시 빈 목록으로 처리
      }
    }

    // 원본 경로가 잠긴 폴더인지 확인
    const isSourceLocked = lockedFolders.some(lockedPath => oldPath === lockedPath);
    if (isSourceLocked) {
      errorLogWithIP(`잠긴 폴더 이동/이름 변경 시도: ${fullOldPath}`, null, req);
      return res.status(403).send('잠긴 폴더는 이동하거나 이름을 변경할 수 없습니다.');
    }

    // 타겟 경로가 제공되면 이동 작업으로 처리 (빈 문자열이면 루트 폴더로 이동)
    const fullTargetPath = targetPath !== undefined 
      ? path.join(ROOT_DIRECTORY, targetPath) 
      : path.dirname(fullOldPath);
      
    const fullNewPath = path.join(fullTargetPath, newName);
      
    logWithIP(`전체 경로 처리: ${fullOldPath} -> ${fullNewPath}`, 'debug');
    logWithIP(`디버그: targetPath=${targetPath}, fullTargetPath=${fullTargetPath}, overwrite=${overwrite}`, 'debug');

    // 원본과 대상이 같은 경로인지 확인
    if (fullOldPath === fullNewPath) {
      logWithIP(`동일한 경로로의 이동 무시: ${fullOldPath}`, 'debug');
      return res.status(200).send('이동이 완료되었습니다.');
    }

    // 대상 경로의 디렉토리가 없으면 생성
    if (!fs.existsSync(fullTargetPath)) {
      logWithIP(`대상 디렉토리 생성: ${fullTargetPath}`, 'debug');
      fs.mkdirSync(fullTargetPath, { recursive: true });
      fs.chmodSync(fullTargetPath, 0o777);
    }

    // 대상 경로에 이미 존재하는지 확인
    if (fs.existsSync(fullNewPath)) {
      if (overwrite) {
        // 덮어쓰기 옵션이 true면 기존 파일/폴더 삭제
        logWithIP(`파일이 이미 존재하나 덮어쓰기 옵션 사용: ${fullNewPath}`, 'debug');
        try {
          // 폴더인지 파일인지 확인하여 적절하게 삭제
          const stats = fs.statSync(fullNewPath);
          if (stats.isDirectory()) {
            fs.rmdirSync(fullNewPath, { recursive: true });
          } else {
            fs.unlinkSync(fullNewPath);
          }
        } catch (deleteError) {
          errorLogWithIP(`기존 파일/폴더 삭제 오류: ${fullNewPath}`, deleteError, req);
          return res.status(500).send(`기존 파일 삭제 중 오류가 발생했습니다: ${deleteError.message}`);
        }
      } else {
        // 덮어쓰기 옵션이 없으면 409 Conflict 반환
        errorLogWithIP(`이미 존재하는 이름: ${fullNewPath}`);
        return res.status(409).send('이미 존재하는 이름입니다.');
      }
    }

    // 이름 변경 (파일 이동)
    try {
      fs.renameSync(fullOldPath, fullNewPath);
      logWithIP(`이동 완료: ${fullOldPath} -> ${fullNewPath}`, 'info');
      
      res.status(200).send('이동이 완료되었습니다.');
    } catch (renameError) {
      // EXDEV 오류는 서로 다른 디바이스 간 이동 시 발생
      if (renameError.code === 'EXDEV') {
        errorLogWithIP('서로 다른 파일 시스템 간 이동 오류 (EXDEV)', renameError, req);
        return res.status(500).send('서로 다른 디바이스 간에 파일을 이동할 수 없습니다. 파일을 복사 후 원본을 삭제해주세요.');
      }
      
      errorLogWithIP(`이름 변경/이동 오류: ${fullOldPath} -> ${fullNewPath}`, renameError, req);
      return res.status(500).send(`이동 오류: ${renameError.message}`);
    }
  } catch (error) {
    errorLogWithIP('이름 변경 오류:', error, req);
    res.status(500).send(`서버 오류가 발생했습니다: ${error.message}`);
  }
});

// 파일/폴더 삭제 (백그라운드 처리)
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
        detached: true, // 부모 프로세스와 분리
        stdio: 'ignore'  // 워커의 출력을 메인 프로세스에 연결하지 않음
      });

      worker.on('error', (err) => {
        errorLogWithIP(`백그라운드 워커 생성 오류: ${fullPath}`, err, req);
      });

      worker.unref(); // 부모 프로세스가 워커 종료를 기다리지 않도록 함

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
    // 핸들러 자체의 예외 처리
    errorLogWithIP('삭제 API 핸들러 오류:', error, req);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 폴더 생성 API (백그라운드 처리 예시)
app.post('/api/folders', express.json(), (req, res) => {
    try {
        const { folderPath, folderName } = req.body;
        // 폴더 이름 유효성 검사 강화 (슬래시 등 경로 문자 방지)
        if (!folderName || /[\\/:*?"<>|]/.test(folderName) || folderName.trim() !== folderName) {
            return res.status(400).send('잘못된 폴더 이름입니다.');
        }

        const relativePath = folderPath ? path.join(folderPath, folderName) : folderName;
        const fullPath = path.join(ROOT_DIRECTORY, relativePath);

        logWithIP(`[Create Folder Request] '${relativePath}' 생성 요청 (백그라운드 처리)`, req, 'info');

        // 백그라운드 작업 시작
        logWithIP(`백그라운드 폴더 생성 작업 시작 요청: ${fullPath}`, req, 'info');
        const workerScript = path.join(__dirname, 'backgroundWorker.js');
        const worker = fork(workerScript, ['create', fullPath], {
            detached: true,
            stdio: 'ignore'
        });

        worker.on('error', (err) => {
            errorLogWithIP(`백그라운드 워커 생성 오류 (폴더 생성): ${fullPath}`, err, req);
        });
        worker.unref();

        // 즉시 응답 (202 Accepted)
        res.status(202).send('폴더 생성 작업이 백그라운드에서 시작되었습니다.');

    } catch (error) {
        errorLogWithIP('폴더 생성 API 핸들러 오류:', error, req);
        res.status(500).send('서버 오류가 발생했습니다.');
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

// 서버 시작
app.listen(PORT, () => {
  log(`서버가 ${PORT} 포트에서 실행 중입니다. 로그 레벨: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLogLevel)}`, 'minimal'); // 서버 시작은 minimal 레벨
  log(`WebDAV 서버: http://localhost:${PORT}/webdav`, 'info');
}); 