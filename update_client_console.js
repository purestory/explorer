const fs = require('fs');
const path = require('path');

// 수정할 파일 경로
const scriptFilePath = path.join(__dirname, 'frontend', 'script.js');

// 파일 읽기
console.log('원본 파일 읽는 중...');
let scriptCode = fs.readFileSync(scriptFilePath, 'utf8');

// 수정 전 백업 생성
const backupPath = path.join(__dirname, 'frontend', 'script.js.bak');
fs.writeFileSync(backupPath, scriptCode, 'utf8');
console.log(`백업 파일 생성됨: ${backupPath}`);

// 수정 패턴
console.log('콘솔 로그 제거 중...');

// 변경 전 console.log 호출 횟수 계산
const logCount = (scriptCode.match(/console\.log\(/g) || []).length;
const infoCount = (scriptCode.match(/console\.info\(/g) || []).length;
const warnCount = (scriptCode.match(/console\.warn\(/g) || []).length;
const debugCount = (scriptCode.match(/console\.debug\(/g) || []).length;

// 1. console.log 제거 - 개발 모드 조건부 로그로 변경
scriptCode = scriptCode.replace(
  /console\.log\((.*?)\);/g, 
  "//console.log($1); // 콘솔 출력 제거됨"
);

// 2. console.info 제거
scriptCode = scriptCode.replace(
  /console\.info\((.*?)\);/g, 
  "//console.info($1); // 콘솔 출력 제거됨"
);

// 3. console.warn 제거
scriptCode = scriptCode.replace(
  /console\.warn\((.*?)\);/g, 
  "//console.warn($1); // 콘솔 출력 제거됨"
);

// 4. console.debug 제거
scriptCode = scriptCode.replace(
  /console\.debug\((.*?)\);/g, 
  "//console.debug($1); // 콘솔 출력 제거됨"
);

// 5. 개발 모드 로깅 설정 추가
// 파일 시작 부분에 추가할 개발 모드 설정 코드
const devModeCode = `
// 개발 모드 설정 - false로 설정하면 콘솔 로그가 표시되지 않습니다
window.DEBUG_MODE = false;

// 원래의 console.log를 저장
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleDebug = console.debug;

// console 메서드 재정의 - 에러는 항상 표시, 나머지는 DEBUG_MODE일 때만 표시
console.log = function(...args) {
  if (window.DEBUG_MODE) {
    originalConsoleLog.apply(console, args);
  }
};

console.info = function(...args) {
  if (window.DEBUG_MODE) {
    originalConsoleInfo.apply(console, args);
  }
};

console.warn = function(...args) {
  if (window.DEBUG_MODE) {
    originalConsoleWarn.apply(console, args);
  }
};

console.debug = function(...args) {
  if (window.DEBUG_MODE) {
    originalConsoleDebug.apply(console, args);
  }
};

// error는 항상 표시되도록 유지
`;

// 수정된 코드 앞에 개발 모드 설정 코드 추가
scriptCode = devModeCode + scriptCode;

// 6. 파일 쓰기
console.log('수정된 파일 저장 중...');
fs.writeFileSync(scriptFilePath, scriptCode, 'utf8');

// 변경 후 console.log 호출 횟수 계산
const remainingLogCount = (scriptCode.match(/console\.log\(/g) || []).length - 5; // 우리가 추가한 5개 제외

console.log('완료!');

// 변경 내용 요약
console.log('\n변경 내용 요약:');
console.log(`1. console.log 호출 ${logCount}개 주석 처리`);
console.log(`2. console.info 호출 ${infoCount}개 주석 처리`);
console.log(`3. console.warn 호출 ${warnCount}개 주석 처리`);
console.log(`4. console.debug 호출 ${debugCount}개 주석 처리`);
console.log('5. 개발 모드 설정 코드 추가 (window.DEBUG_MODE = false)');
console.log(`   - DEBUG_MODE=true로 설정하면 콘솔 로그 다시 활성화 가능`);
console.log(`   - 콘솔 에러는 항상 표시됨`);
console.log(`\n남아있는 console.log 호출: ${remainingLogCount}개 (개발 모드 조건부 로깅 제외)`);
console.log('\n서버를 재시작하세요: sudo systemctl restart webdav'); 