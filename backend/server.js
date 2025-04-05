const express = require('express');
const webdav = require('webdav-server').v2;
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { execSync } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3333;

// Multer 설정 (Memory Storage 사용)
const storage = multer.memoryStorage(); // memoryStorage 사용으로 변경
const uploadMiddleware = multer({
  storage: storage, // memoryStorage 사용
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024 // 10GB
  }
});

// 로그 디렉토리 확인 및 생성
const LOGS_DIRECTORY = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIRECTORY)) {
  fs.mkdirSync(LOGS_DIRECTORY, { recursive: true });
}

// 로깅 설정
const logFile = fs.createWriteStream(path.join(LOGS_DIRECTORY, 'server.log'), { flags: 'a' });
const errorLogFile = fs.createWriteStream(path.join(LOGS_DIRECTORY, 'error.log'), { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  logFile.write(logMessage);
  console.log(message);
}

function logWithIP(message, req) {
  let ip = 'unknown';
  if (req && req.headers) {
    ip = req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] ||
         (req.connection && req.connection.remoteAddress) ||
         (req.socket && req.socket.remoteAddress) ||
         (req.connection && req.connection.socket && req.connection.socket.remoteAddress) ||
         'unknown';
  }
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - [IP: ${ip}] ${message}\n`;
  logFile.write(logMessage);
  console.log(`[IP: ${ip}] ${message}`);
}

function errorLog(message, error) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ERROR: ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;
  errorLogFile.write(logMessage);
  console.error(message, error);
}

function errorLogWithIP(message, error, req) {
  let ip = 'unknown';
  if (req && req.headers) {
    ip = req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] ||
         (req.connection && req.connection.remoteAddress) ||
         (req.socket && req.socket.remoteAddress) ||
         (req.connection && req.connection.socket && req.connection.socket.remoteAddress) ||
         'unknown';
  }
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ERROR: [IP: ${ip}] ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;
  errorLogFile.write(logMessage);
  console.error(`[IP: ${ip}] ${message}`, error);
}

// 최대 저장 용량 설정 (100GB)
const MAX_STORAGE_SIZE = 100 * 1024 * 1024 * 1024; // 100GB in bytes

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
  log(`루트 디렉토리 생성: ${ROOT_DIRECTORY}`);
}

// 권한 설정
fs.chmodSync(ROOT_DIRECTORY, 0o777);
log(`루트 디렉토리 권한 설정: ${ROOT_DIRECTORY}`);

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
  // 파일 업로드 요청의 경우 용량 체크
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
  
  next();
});

// Express 내장 body-parser 설정 (크기 제한 증가)
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 기본 미들웨어 설정
app.use(express.static(path.join(__dirname, '../frontend')));

// 로깅 미들웨어
app.use((req, res, next) => {
  logWithIP(`${req.method} ${req.url}`, req);
  next();
});

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 파일 업로드 API (Multer 미들웨어 직접 적용)
app.post('/api/upload', uploadMiddleware.any(), (req, res) => {
  // Multer 미들웨어가 먼저 실행됨. 수동 실행 로직 제거.

  // 오류 처리 (Multer 오류는 Express 오류 핸들러나 try-catch로 처리 가능하나 여기선 간단히 확인)
  if (!req.files || req.files.length === 0) {
    // Multer가 파일을 처리하지 못했거나 파일이 없는 경우
    // (파일 크기 초과 등의 Multer 자체 오류는 별도 오류 핸들러 필요)
    errorLogWithIP('업로드 요청에 파일이 없거나 처리 중 오류 발생.', null, req);
    // 413 오류가 Multer에서 발생했다면 err 객체가 있을 수 있으나, 여기서는 일반적인 실패로 처리
    // 실제 Multer 에러 메시지를 받으려면 에러 핸들링 미들웨어 필요
    return res.status(400).json({ error: '파일이 없거나 업로드 처리 중 오류가 발생했습니다.' }); 
  }
  if (!req.body.fileInfo) {
    errorLogWithIP('업로드 요청에 파일 정보(fileInfo)가 없습니다.', null, req);
    return res.status(400).json({ error: '파일 정보가 누락되었습니다.' });
  }
  
  // 이하 기존 파일 처리 로직 (upload(req, res, ...) 콜백 함수 내부 로직을 여기로 이동)
  // 4. 데이터 파싱 및 경로 설정
  const baseUploadPath = req.body.path || ''; // 클라이언트가 지정한 기본 업로드 경로
  const rootUploadDir = path.join(ROOT_DIRECTORY, baseUploadPath);
  let fileInfoArray;

  try {
    fileInfoArray = JSON.parse(req.body.fileInfo);
    logWithIP(`파일 정보 수신: ${fileInfoArray.length}개 항목`, req);
  } catch (parseError) {
    errorLogWithIP('fileInfo JSON 파싱 오류:', parseError, req);
    return res.status(400).json({ error: '잘못된 파일 정보 형식입니다.' });
  }

  logWithIP(`기본 업로드 경로: ${baseUploadPath || '루트 디렉토리'}, 절대 경로: ${rootUploadDir}`, req);

  // 5. 각 파일 처리 및 저장
  const processedFiles = [];
  const errors = [];

  // 최대 파일명 길이 제한 설정 (바이트 기준, 시스템 최대치의 90%)
  const MAX_FILENAME_BYTES = 229;
  // 최대 경로 길이 제한 (시스템마다 다를 수 있음)
  const MAX_PATH_BYTES = 3800; // 일반적인 최대값보다 안전한 값으로 설정

  // 파일명 길이 제한 함수 (바이트 기준)
  function truncateFileName(filename) {
    if (Buffer.byteLength(filename) <= MAX_FILENAME_BYTES) {
      return filename;
    }
    
    const extension = filename.lastIndexOf('.') > 0 ? filename.substring(filename.lastIndexOf('.')) : '';
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.') > 0 ? filename.lastIndexOf('.') : filename.length);
    
    // 바이트 길이 기준으로 자르기
    let truncatedName = nameWithoutExt;
    while (Buffer.byteLength(truncatedName + '...' + extension) > MAX_FILENAME_BYTES) {
      // 문자열 끝에서 한 글자씩 제거 (멀티바이트 문자 고려)
      truncatedName = truncatedName.slice(0, -1); 
      if (truncatedName.length === 0) break; // 이름 부분이 없어지면 중단
    }
    
    const newFileName = truncatedName + '...' + extension;
    
    logWithIP(`파일명이 너무 김(Bytes: ${Buffer.byteLength(filename)}): ${filename} → ${newFileName}`, req);
    return newFileName;
  }

  // 경로 길이 확인 및 제한 함수
  function checkAndTruncatePath(fullPath) {
    const fullPathBytes = Buffer.byteLength(fullPath);
    if (fullPathBytes <= MAX_PATH_BYTES) {
      return { path: fullPath, truncated: false };
    }
    
    // 경로가 너무 길 경우 처리 로직
    logWithIP(`경로가 너무 깁니다(Bytes: ${fullPathBytes}): ${fullPath}`, req);
    
    // 경로 분해 및 분석
    const pathParts = fullPath.split(path.sep);
    const driveOrRoot = pathParts[0] || '/'; // 드라이브 또는 루트 디렉토리
    
    // 마지막 요소는 파일명일 수 있으므로 보존 우선
    const lastElement = pathParts[pathParts.length - 1];
    const isLastElementFile = lastElement.includes('.');
    
    // 각 디렉토리 이름의 최대 바이트 수를 계산
    // 파일명, 루트, 구분자 길이를 뺀 나머지 공간을 디렉토리들이 공유
    const fileNameBytes = isLastElementFile ? Buffer.byteLength(lastElement) : 0;
    const rootBytes = Buffer.byteLength(driveOrRoot);
    const separatorBytes = (pathParts.length - 1) * Buffer.byteLength(path.sep);
    
    // 디렉토리에 할당할 수 있는 총 바이트 (파일명 제외)
    const totalDirBytes = MAX_PATH_BYTES - fileNameBytes - rootBytes - separatorBytes;
    
    // 디렉토리 수 (파일명 제외)
    const dirCount = isLastElementFile ? pathParts.length - 2 : pathParts.length - 1;
    
    // 각 디렉토리당 평균 할당 바이트 (최소 20바이트 보장)
    const avgMaxBytes = Math.max(20, Math.floor(totalDirBytes / (dirCount > 0 ? dirCount : 1)));
    
    // 각 경로 부분 순회하며 길이 제한
    const truncatedParts = [driveOrRoot];
    let bytesUsed = rootBytes + separatorBytes;
    
    for (let i = 1; i < pathParts.length; i++) {
      let part = pathParts[i];
      const partBytes = Buffer.byteLength(part);
      
      // 마지막 요소이고 파일이면 가능한 한 원본 유지
      if (i === pathParts.length - 1 && isLastElementFile) {
        // 파일명이 너무 긴 경우 별도 처리 (마지막 요소만 truncateFileName 호출)
        if (partBytes > MAX_FILENAME_BYTES) {
          part = truncateFileName(part);
        }
        truncatedParts.push(part);
        continue;
      }
      
      // 디렉토리 이름이 할당된 바이트 수를 초과하는 경우 자르기
      if (partBytes > avgMaxBytes) {
        // 디렉토리 이름 자르기 (한글 등 멀티바이트 문자 고려)
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
        
        // 이름이 너무 짧아졌다면 최소 한 글자 이상 포함하도록 함
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
    
    logWithIP(`경로 길이 제한: ${fullPathBytes} → ${finalPathBytes} 바이트`, req);
    logWithIP(`줄어든 경로: ${truncatedPath}`, req);
    
    // 최종 확인 - 여전히 너무 길면 더 강력하게 줄이기
    if (finalPathBytes > MAX_PATH_BYTES) {
      // 문제 해결을 위한 비상 대책 - 파일명 유지하고 중간 경로 크게 축소
      const rootAndFile = isLastElementFile ? 
        [driveOrRoot, truncateFileName(lastElement)] : 
        [driveOrRoot, truncatedParts[truncatedParts.length - 1]];
        
      // 파일명과 루트 사이에 "..." 추가하여 모든 중간 경로 제거
      const emergencyPath = rootAndFile.join(path.sep + '...' + path.sep);
      logWithIP(`비상 경로 축소: ${truncatedPath} → ${emergencyPath}`, req);
      return { path: emergencyPath, truncated: true, emergency: true };
    }
    
    return { path: truncatedPath, truncated: true };
  }

  // req.files 배열과 fileInfoArray 매핑 (순서가 같다고 가정)
  // 클라이언트에서 file_${index} 와 fileInfo 순서를 일치시킴
  req.files.forEach((file, index) => {
      // fileInfoArray 에서 현재 파일과 매칭되는 정보 찾기
      // 클라이언트에서 보낸 file_${index} 의 index를 사용하거나, 순서를 신뢰
      const fileInfo = fileInfoArray.find(info => info.index === index || info.originalName === Buffer.from(file.originalname, 'latin1').toString('utf8'));

      if (!fileInfo || !fileInfo.relativePath) {
          const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          errorLogWithIP(`파일 정보 불일치 또는 상대 경로 누락: ${originalName} (index: ${index})`, null, req);
          errors.push(`파일 ${originalName}의 정보를 찾을 수 없거나 상대 경로가 없습니다.`);
          return; // 다음 파일로 이동
      }

      try {
          // 파일명 길이 확인 및 처리 (바이트 기준)
          let relativeFilePath = fileInfo.relativePath;
          const originalFileName = path.basename(relativeFilePath);
          let finalFileName = originalFileName; // 최종 파일명 변수 추가
          
          // 파일명 바이트 길이가 너무 길면 자르기
          if (Buffer.byteLength(originalFileName) > MAX_FILENAME_BYTES) {
              finalFileName = truncateFileName(originalFileName);
              const dirName = path.dirname(relativeFilePath);
              relativeFilePath = dirName === '.' ? finalFileName : path.join(dirName, finalFileName);
              logWithIP(`파일명 길이 제한(Bytes)으로 변경: ${fileInfo.relativePath} → ${relativeFilePath}`, req);
          }
          
          // 전체 저장 경로 계산 (루트 업로드 디렉토리 + 수정된 상대 경로)
          let destinationPath = path.join(rootUploadDir, relativeFilePath);
          
          // 전체 경로 길이 확인 및 처리
          const pathResult = checkAndTruncatePath(destinationPath);
          if (pathResult.truncated) {
              destinationPath = pathResult.path;
              // 경로 변경에 따른 상대 경로 재계산 (저장용)
              relativeFilePath = destinationPath.substring(rootUploadDir.length);
              // 경로 시작에 '/' 있으면 제거
              if (relativeFilePath.startsWith(path.sep)) {
                  relativeFilePath = relativeFilePath.substring(1);
              }
              logWithIP(`전체 경로가 너무 길어 변경됨: ${relativeFilePath}`, req);
          }

          // 저장될 디렉토리 경로 추출
          const destinationDir = path.dirname(destinationPath);

          // 디렉토리 생성 (필요한 경우)
          if (!fs.existsSync(destinationDir)) {
              fs.mkdirSync(destinationDir, { recursive: true });
              fs.chmodSync(destinationDir, 0o777); // 생성된 디렉토리 권한 설정
              logWithIP(`하위 디렉토리 생성됨: ${destinationDir}`, req);
          }

          logWithIP(`[Upload Detail] 최종 경로: ${destinationPath}`, req);

          // 파일 시스템에 저장 (메모리 버퍼 사용)
          fs.writeFileSync(destinationPath, file.buffer); // <--- renameSync 대신 writeFileSync 사용
          fs.chmodSync(destinationPath, 0o666); // 저장된 파일 권한 설정

          // 처리된 파일 정보 저장
          processedFiles.push({
              name: path.basename(destinationPath), // 실제 저장된 파일명
              originalName: fileInfo.originalName,
              relativePath: destinationPath.substring(rootUploadDir.length).replace(/^\\+|^\//, ''), // 실제 저장된 경로 기준 상대경로
              size: file.size,
              path: baseUploadPath,
              mimetype: file.mimetype,
              fullPath: destinationPath
          });

          logWithIP(`파일 저장 완료 (메모리 사용): ${destinationPath} (크기: ${formatBytes(file.size)})`, req);

      } catch (writeError) {
          errorLogWithIP(`파일 저장 중 오류: ${fileInfo.relativePath}`, writeError, req);
          errors.push(`파일 ${fileInfo.relativePath} 저장 중 오류 발생: ${writeError.message}`);
      }
  });

  // 6. 최종 응답 전송
  if (errors.length > 0) {
    // 일부 오류 발생
    logWithIP(`파일 업로드 중 ${errors.length}개의 오류 발생`, req);
    res.status(207).json({ // Multi-Status 응답
      message: `일부 파일 업로드 중 오류 발생 (${processedFiles.length}개 성공, ${errors.length}개 실패)`,
      processedFiles: processedFiles,
      errors: errors
    });
  } else {
    // 모든 파일 성공
    logWithIP(`${processedFiles.length}개 파일 업로드 성공`, req);
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
    log(`디스크 사용량 조회: ${formatFileSize(diskUsage.used)} / ${formatFileSize(diskUsage.total)} (${diskUsage.percent}%)`);
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
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: '압축할 파일이 선택되지 않았습니다.' });
    }
    
    if (!zipName) {
      return res.status(400).json({ error: '압축 파일 이름이 필요합니다.' });
    }
    
    log(`압축 요청: ${files.length}개 파일, 대상 경로: ${targetPath || '루트'}, 압축파일명: ${zipName}`);
    
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
    log(`실행 명령어: ${zipCommand}`);
    execSync(zipCommand);
    
    // 압축 파일 권한 설정
    fs.chmodSync(zipFilePath, 0o666);
    
    log(`압축 완료: ${zipFilePath}`);
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
    
    log(`잠금 상태 조회: ${lockState.length}개 폴더 잠김`);
    res.status(200).json({ lockState });
  } catch (error) {
    errorLog('잠금 상태 조회 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 폴더 잠금/해제 API
app.post('/api/lock/:path(*)', (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    const folderPath = decodeURIComponent(req.params.path || '');
    const action = req.body.action || 'lock'; // 'lock' 또는 'unlock'
    const fullPath = path.join(ROOT_DIRECTORY, folderPath);
    
    log(`폴더 ${action === 'lock' ? '잠금' : '잠금 해제'} 요청: ${fullPath}`);

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
          log(`상위 폴더가 이미 잠겨 있어 ${folderPath} 폴더는 잠그지 않습니다.`);
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
          log(`${folderPath} 폴더 잠금으로 인해 ${subLockedFolders.length}개의 하위 폴더 잠금이 해제됩니다.`);
          // 하위 폴더는 잠금 해제
          lockedFolders.lockState = lockedFolders.lockState.filter(path => 
            !path.startsWith(folderPath + '/'));
        }
        
        // 현재 폴더 잠금
        lockedFolders.lockState.push(folderPath);
        log(`폴더 잠금 완료: ${folderPath}`);
      } else {
        log(`폴더가 이미 잠겨 있음: ${folderPath}`);
      }
    } else if (action === 'unlock') {
      // 잠금 해제
      lockedFolders.lockState = lockedFolders.lockState.filter(path => path !== folderPath);
      log(`폴더 잠금 해제 완료: ${folderPath}`);
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
    
    logWithIP(`파일 목록 요청: ${fullPath}`, req);

    // 경로가 존재하는지 확인
    if (!fs.existsSync(fullPath)) {
      errorLogWithIP(`경로를 찾을 수 없습니다: ${fullPath}`, null, req);
      return res.status(404).send('경로를 찾을 수 없습니다.');
    }

    // 디렉토리인지 확인
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      // 파일인 경우 처리
      logWithIP(`파일 다운로드 요청: ${fullPath}`, req);
      
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
            logWithIP(`파일 다운로드 완료: ${fullPath}`, req);
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

    logWithIP(`파일 목록 반환: ${fileItems.length}개 항목`, req);
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
    
    logWithIP(`폴더 생성 요청: ${fullPath}`, req);

    // 이미 존재하는지 확인
    if (fs.existsSync(fullPath)) {
      errorLogWithIP(`이미 존재하는 폴더: ${fullPath}`, null, req);
      return res.status(409).send('이미 존재하는 이름입니다.');
    }

    // 폴더 생성
    fs.mkdirSync(fullPath, { recursive: true });
    fs.chmodSync(fullPath, 0o777);
    
    logWithIP(`폴더 생성 완료: ${fullPath}`, req);
    res.status(201).send('폴더가 생성되었습니다.');
  } catch (error) {
    errorLogWithIP('폴더 생성 오류:', error, req);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 파일/폴더 이름 변경 또는 이동
app.put('/api/files/*', (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    const oldPath = decodeURIComponent(req.params[0] || '');
    const { newName, targetPath, overwrite } = req.body;
    
    logWithIP(`이름 변경/이동 요청: ${oldPath} -> ${newName}, 대상 경로: ${targetPath !== undefined ? targetPath : '현재 경로'}, 덮어쓰기: ${overwrite ? '예' : '아니오'}`, req);
    
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

    // 타겟 경로가 제공되면 이동 작업으로 처리 (빈 문자열이면 루트 폴더로 이동)
    const fullTargetPath = targetPath !== undefined 
      ? path.join(ROOT_DIRECTORY, targetPath) 
      : path.dirname(fullOldPath);
      
    const fullNewPath = path.join(fullTargetPath, newName);
      
    logWithIP(`전체 경로 처리: ${fullOldPath} -> ${fullNewPath}`);
    logWithIP(`디버그: targetPath=${targetPath}, fullTargetPath=${fullTargetPath}, overwrite=${overwrite}`);

    // 원본과 대상이 같은 경로인지 확인
    if (fullOldPath === fullNewPath) {
      logWithIP(`동일한 경로로의 이동 무시: ${fullOldPath}`);
      return res.status(200).send('이동이 완료되었습니다.');
    }

    // 대상 경로의 디렉토리가 없으면 생성
    if (!fs.existsSync(fullTargetPath)) {
      logWithIP(`대상 디렉토리 생성: ${fullTargetPath}`);
      fs.mkdirSync(fullTargetPath, { recursive: true });
      fs.chmodSync(fullTargetPath, 0o777);
    }

    // 대상 경로에 이미 존재하는지 확인
    if (fs.existsSync(fullNewPath)) {
      if (overwrite) {
        // 덮어쓰기 옵션이 true면 기존 파일/폴더 삭제
        logWithIP(`파일이 이미 존재하나 덮어쓰기 옵션 사용: ${fullNewPath}`);
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
      logWithIP(`이동 완료: ${fullOldPath} -> ${fullNewPath}`);
      
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

// 파일/폴더 삭제
app.delete('/api/files/*', (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    const itemPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, itemPath);
    
    logWithIP(`삭제 요청: ${fullPath}`, req);

    // 존재하는지 확인
    if (!fs.existsSync(fullPath)) {
      errorLogWithIP(`파일/폴더를 찾을 수 없음: ${fullPath}`, null, req);
      return res.status(404).send('파일 또는 폴더를 찾을 수 없습니다.');
    }

    // lockedFolders.json 파일에서 잠긴 폴더 목록 로드
    let lockedFolders = [];
    const lockedFoldersPath = path.join(__dirname, 'lockedFolders.json');
    if (fs.existsSync(lockedFoldersPath)) {
      try {
        lockedFolders = JSON.parse(fs.readFileSync(lockedFoldersPath, 'utf8')).lockState || [];
      } catch (e) {
        errorLogWithIP('잠긴 폴더 목록 로드 오류:', e, req);
        lockedFolders = [];
      }
    }

    // 디렉토리인지 확인
    const stats = fs.statSync(fullPath);
    const isDirectory = stats.isDirectory();

    // 현재 경로나 그 상위 경로가 잠겨있는지 확인
    const isLocked = lockedFolders.some(lockedPath => {
      return itemPath === lockedPath || itemPath.startsWith(lockedPath + '/');
    });

    // 현재 폴더 내에 잠긴 폴더가 있는지 확인 (폴더인 경우만)
    let hasLockedSubfolders = false;
    if (isDirectory) {
      hasLockedSubfolders = lockedFolders.some(lockedPath => {
        // 현재 삭제하려는 경로가 잠긴 폴더의 상위 경로인지 확인
        return lockedPath.startsWith(itemPath + '/');
      });
    }

    // 잠금 확인
    if (isLocked || hasLockedSubfolders) {
      errorLogWithIP(`잠긴 폴더 혹은 내부에 잠긴 폴더가 있는 폴더 삭제 시도: ${fullPath}`, null, req);
      return res.status(403).send('잠긴 폴더 또는 잠긴 폴더를 포함한 폴더는 삭제할 수 없습니다.');
    }

    if (isDirectory) {
      // 폴더 삭제 (재귀적)
      fs.rmdirSync(fullPath, { recursive: true });
      logWithIP(`폴더 삭제 완료: ${fullPath}`, req);
    } else {
      // 파일 삭제
      fs.unlinkSync(fullPath);
      logWithIP(`파일 삭제 완료: ${fullPath}`, req);
    }

    res.status(200).send('삭제되었습니다.');
  } catch (error) {
    errorLogWithIP('삭제 오류:', error, req);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 서버 시작
app.listen(PORT, () => {
  log(`서버가 시작되었습니다. http://localhost:${PORT}`);
  log(`WebDAV 서버: http://localhost:${PORT}/webdav`);
}); 