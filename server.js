const express = require('express');
const webdav = require('webdav-server').v2;
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { execSync } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3333;

// 로깅 설정
const logFile = fs.createWriteStream('/var/log/webdav/server.log', { flags: 'a' });
const errorLogFile = fs.createWriteStream('/var/log/webdav/error.log', { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  logFile.write(logMessage);
  console.log(message);
}

function errorLog(message, error) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ERROR: ${message} - ${error ? (error.stack || error.message || error) : 'Unknown error'}\n`;
  errorLogFile.write(logMessage);
  console.error(message, error);
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

// 기본 미들웨어 설정
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// 로깅 미들웨어
app.use((req, res, next) => {
  log(`${req.method} ${req.url}`);
  next();
});

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 경로 정보가 있으면 해당 경로에 저장, 없으면 루트 디렉토리에 저장
    const uploadPath = req.body.path 
      ? path.join(ROOT_DIRECTORY, req.body.path) 
      : ROOT_DIRECTORY;
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      fs.chmodSync(uploadPath, 0o777);
    }
    
    log(`업로드 대상 폴더: ${uploadPath}`);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // 원본 파일명에서 한글 인코딩 처리
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    log(`업로드 파일명: ${originalName}`);
    cb(null, originalName);
  }
});
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024 // 10GB
  }
});

// API 라우트 설정
// 파일 목록 가져오기
app.get('/api/files/*', async (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    let requestPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, requestPath);
    
    log(`파일 목록 요청: ${fullPath}`);

    // 경로가 존재하는지 확인
    if (!fs.existsSync(fullPath)) {
      errorLog(`경로를 찾을 수 없습니다: ${fullPath}`);
      return res.status(404).send('경로를 찾을 수 없습니다.');
    }

    // 디렉토리인지 확인
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      // 파일인 경우 처리
      log(`파일 요청: ${fullPath}`);
      
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
        res.download(fullPath);
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

    log(`파일 목록 반환: ${fileItems.length}개 항목`);
    res.json(fileItems);
  } catch (error) {
    errorLog('파일 목록 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 새 폴더 생성
app.post('/api/files/*', (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    const folderPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, folderPath);
    
    log(`폴더 생성 요청: ${fullPath}`);

    // 이미 존재하는지 확인
    if (fs.existsSync(fullPath)) {
      errorLog(`이미 존재하는 폴더: ${fullPath}`);
      return res.status(409).send('이미 존재하는 이름입니다.');
    }

    // 폴더 생성
    fs.mkdirSync(fullPath, { recursive: true });
    fs.chmodSync(fullPath, 0o777);
    
    log(`폴더 생성 완료: ${fullPath}`);
    res.status(201).send('폴더가 생성되었습니다.');
  } catch (error) {
    errorLog('폴더 생성 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 파일/폴더 이름 변경
app.put('/api/files/*', (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    const oldPath = decodeURIComponent(req.params[0] || '');
    const { newName, targetPath, overwrite } = req.body;
    
    log(`이름 변경/이동 요청: ${oldPath} -> ${newName}, 대상 경로: ${targetPath !== undefined ? targetPath : '현재 경로'}, 덮어쓰기: ${overwrite ? '예' : '아니오'}`);
    
    if (!newName) {
      errorLog('새 이름이 제공되지 않음');
      return res.status(400).send('새 이름이 제공되지 않았습니다.');
    }

    const fullOldPath = path.join(ROOT_DIRECTORY, oldPath);
    
    // 원본이 존재하는지 확인
    if (!fs.existsSync(fullOldPath)) {
      errorLog(`원본 파일/폴더를 찾을 수 없음: ${fullOldPath}`);
      return res.status(404).send(`파일 또는 폴더를 찾을 수 없습니다: ${oldPath}`);
    }

    // 타겟 경로가 제공되면 이동 작업으로 처리 (빈 문자열이면 루트 폴더로 이동)
    const fullTargetPath = targetPath !== undefined 
      ? path.join(ROOT_DIRECTORY, targetPath) 
      : path.dirname(fullOldPath);
      
    const fullNewPath = path.join(fullTargetPath, newName);
      
    log(`전체 경로 처리: ${fullOldPath} -> ${fullNewPath}`);
    log(`디버그: targetPath=${targetPath}, fullTargetPath=${fullTargetPath}, overwrite=${overwrite}`);

    // 원본과 대상이 같은 경로인지 확인
    if (fullOldPath === fullNewPath) {
      log(`동일한 경로로의 이동 무시: ${fullOldPath}`);
      return res.status(200).send('이동이 완료되었습니다.');
    }

    // 대상 경로의 디렉토리가 없으면 생성
    if (!fs.existsSync(fullTargetPath)) {
      log(`대상 디렉토리 생성: ${fullTargetPath}`);
      fs.mkdirSync(fullTargetPath, { recursive: true });
      fs.chmodSync(fullTargetPath, 0o777);
    }

    // 대상 경로에 이미 존재하는지 확인
    if (fs.existsSync(fullNewPath)) {
      if (overwrite) {
        // 덮어쓰기 옵션이 true면 기존 파일/폴더 삭제
        log(`파일이 이미 존재하나 덮어쓰기 옵션 사용: ${fullNewPath}`);
        try {
          // 폴더인지 파일인지 확인하여 적절하게 삭제
          const stats = fs.statSync(fullNewPath);
          if (stats.isDirectory()) {
            fs.rmdirSync(fullNewPath, { recursive: true });
          } else {
            fs.unlinkSync(fullNewPath);
          }
        } catch (deleteError) {
          errorLog(`기존 파일/폴더 삭제 오류: ${fullNewPath}`, deleteError);
          return res.status(500).send(`기존 파일 삭제 중 오류가 발생했습니다: ${deleteError.message}`);
        }
      } else {
        // 덮어쓰기 옵션이 없으면 409 Conflict 반환
        errorLog(`이미 존재하는 이름: ${fullNewPath}`);
        return res.status(409).send('이미 존재하는 이름입니다.');
      }
    }

    // 이름 변경 (파일 이동)
    try {
      fs.renameSync(fullOldPath, fullNewPath);
      log(`이동 완료: ${fullOldPath} -> ${fullNewPath}`);
      
      res.status(200).send('이동이 완료되었습니다.');
    } catch (renameError) {
      // EXDEV 오류는 서로 다른 디바이스 간 이동 시 발생
      if (renameError.code === 'EXDEV') {
        errorLog('서로 다른 파일 시스템 간 이동 오류 (EXDEV)', renameError);
        return res.status(500).send('서로 다른 디바이스 간에 파일을 이동할 수 없습니다. 파일을 복사 후 원본을 삭제해주세요.');
      }
      
      errorLog(`이름 변경/이동 오류: ${fullOldPath} -> ${fullNewPath}`, renameError);
      return res.status(500).send(`이동 오류: ${renameError.message}`);
    }
  } catch (error) {
    errorLog('이름 변경 오류:', error);
    res.status(500).send(`서버 오류가 발생했습니다: ${error.message}`);
  }
});

// 파일/폴더 삭제
app.delete('/api/files/*', (req, res) => {
  try {
    // URL 디코딩하여 한글 경로 처리
    const itemPath = decodeURIComponent(req.params[0] || '');
    const fullPath = path.join(ROOT_DIRECTORY, itemPath);
    
    log(`삭제 요청: ${fullPath}`);

    // 존재하는지 확인
    if (!fs.existsSync(fullPath)) {
      errorLog(`파일/폴더를 찾을 수 없음: ${fullPath}`);
      return res.status(404).send('파일 또는 폴더를 찾을 수 없습니다.');
    }

    // 디렉토리인지 확인
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      // 폴더 삭제 (재귀적)
      fs.rmdirSync(fullPath, { recursive: true });
      log(`폴더 삭제 완료: ${fullPath}`);
    } else {
      // 파일 삭제
      fs.unlinkSync(fullPath);
      log(`파일 삭제 완료: ${fullPath}`);
    }

    res.status(200).send('삭제되었습니다.');
  } catch (error) {
    errorLog('삭제 오류:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 파일 업로드 API
app.post('/api/upload', (req, res) => {
  // 요청에서 경로 정보를 추출하기 위한 부분 처리
  const fieldName = 'path';
  const pathStorage = { value: '' };
  
  // 1. 여러 파일을 처리할 수 있도록 multer의 memoryStorage를 사용하여 파일 데이터를 메모리에 저장
  const memoryStorage = multer.memoryStorage();
  const upload = multer({
    storage: memoryStorage,
    limits: {
      fileSize: 10 * 1024 * 1024 * 1024 // 10GB
    }
  }).array('file', 100); // 최대 100개 파일 업로드 허용
  
  // 2. multer로 파일과 필드를 처리
  upload(req, res, function(err) {
    if (err) {
      errorLog('파일 업로드 오류:', err);
      return res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.', message: err.message });
    }
    
    // 3. 파일과 path 필드가 모두 있는지 확인
    if (!req.files || req.files.length === 0) {
      errorLog('업로드 파일이 없습니다.');
      return res.status(400).json({ error: '업로드 파일이 없습니다.' });
    }
    
    // 요청 경로 추출 (form field에서)
    const pathValue = req.body.path || '';
    
    // 4. 파일 저장 경로 결정
    const targetPath = pathValue 
      ? path.join(ROOT_DIRECTORY, pathValue) 
      : ROOT_DIRECTORY;
    
    log(`파일 업로드 요청 경로: ${pathValue || '루트 디렉토리'}, 절대 경로: ${targetPath}`);
    
    // 파일 경로 정보 처리 준비
    const hasFilepaths = req.body.filepath !== undefined;
    // 폴더 구조 정보 확인
    let filepaths = [];
    
    if (hasFilepaths) {
      // filepath 필드가 배열인지 문자열인지 확인
      filepaths = Array.isArray(req.body.filepath) 
        ? req.body.filepath 
        : [req.body.filepath];
        
      log(`폴더 업로드 모드: ${filepaths.length}개의 경로 정보 수신됨`);
      
      // 경로 정보 로깅 (처음 5개만)
      const pathSamples = filepaths.filter(p => p).slice(0, 5);
      if (pathSamples.length > 0) {
        log(`경로 샘플: ${pathSamples.join(', ')}${filepaths.length > 5 ? ' ...' : ''}`);
      }
    } else {
      log('일반 파일 업로드 모드: 경로 정보 없음');
    }
    
    // 5. 대상 디렉토리 확인 및 생성
    if (!fs.existsSync(targetPath)) {
      try {
        fs.mkdirSync(targetPath, { recursive: true });
        fs.chmodSync(targetPath, 0o777);
        log(`업로드 대상 폴더 생성됨: ${targetPath}`);
      } catch (error) {
        errorLog(`폴더 생성 중 오류: ${targetPath}`, error);
        return res.status(500).json({ error: '폴더 생성 중 오류가 발생했습니다.', message: error.message });
      }
    }
    
    // 6. 각 파일 처리
    const processedFiles = [];
    const errors = [];
    const createdDirs = new Set(); // 중복 폴더 생성 방지를 위한 세트
    
    for (let i = 0; i < req.files.length; i++) {
      try {
        const file = req.files[i];
        
        // 원본 파일명에서 한글 인코딩 처리
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        // 폴더 구조 처리
        let filePath = targetPath;
        let relativePath = '';
        
        // 파일 상대 경로 처리 (폴더 업로드 처리)
        if (hasFilepaths && i < filepaths.length) {
          relativePath = filepaths[i] || '';
          
          if (relativePath) {
            // 전체 파일 경로 구성
            filePath = path.join(targetPath, relativePath);
            
            // 존재하지 않는 폴더만 생성 (중복 생성 방지)
            if (!createdDirs.has(filePath)) {
              createdDirs.add(filePath);
              
              // 해당 디렉토리가 없으면 생성
              if (!fs.existsSync(filePath)) {
                fs.mkdirSync(filePath, { recursive: true });
                fs.chmodSync(filePath, 0o777);
                log(`폴더 업로드 - 하위 폴더 생성됨: ${filePath}`);
              }
            }
          }
        }
        
        const destinationFile = path.join(filePath, originalName);
        
        // 파일 시스템에 저장
        fs.writeFileSync(destinationFile, file.buffer);
        fs.chmodSync(destinationFile, 0o666);
        
        // 파일 정보 저장
        processedFiles.push({
          name: originalName,
          size: file.size,
          path: relativePath ? path.join(pathValue, relativePath).replace(/\\/g, '/') : pathValue,
          mimetype: file.mimetype,
          fullPath: destinationFile
        });
        
        // 디버그 정보 로깅 (간략화)
        log(`파일 업로드 성공: ${originalName} (${formatBytes(file.size)}) -> ${relativePath || '루트'}`);
      } catch (error) {
        const errorMsg = `파일 저장 중 오류: ${req.files[i].originalname} - ${error.message}`;
        errorLog(errorMsg, error);
        errors.push({
          file: req.files[i].originalname,
          error: error.message
        });
      }
    }
    
    // 업로드 결과 요약 로깅
    log(`업로드 결과: 성공=${processedFiles.length}개, 실패=${errors.length}개, 총=${req.files.length}개`);
    
    // 7. 응답 전송
    if (processedFiles.length > 0) {
      res.status(201).json({
        message: '파일 업로드 성공',
        files: processedFiles,
        errors: errors.length > 0 ? errors : undefined
      });
    } else if (errors.length > 0) {
      res.status(500).json({
        error: '모든 파일 업로드 실패',
        errors: errors
      });
    } else {
      res.status(400).json({
        error: '파일 처리 실패'
      });
    }
  });
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

// 서버 시작
app.listen(PORT, () => {
  log(`서버가 시작되었습니다. http://localhost:${PORT}`);
  log(`WebDAV 서버: http://localhost:${PORT}/webdav`);
}); 