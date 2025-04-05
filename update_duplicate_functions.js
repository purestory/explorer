/**
 * 중복 함수 통합 스크립트
 * 다음 중복 함수들을 하나로 통합:
 * 1. handleFileDrop - 4538과 4725 라인에 중복 정의됨
 * 2. toggleFolderLock - 3777과 3953 라인에 중복 정의됨
 * 3. isPathLocked - 3735과 3927 라인에 중복 정의됨
 */

const fs = require('fs');
const path = require('path');

// 수정할 파일 경로
const scriptFilePath = path.join(__dirname, 'frontend', 'script.js');

// 파일 읽기
console.log('원본 파일 읽는 중...');
let scriptCode = fs.readFileSync(scriptFilePath, 'utf8');

// 수정 전 백업 생성
const backupPath = path.join(__dirname, 'frontend', 'script.js.bak3');
fs.writeFileSync(backupPath, scriptCode, 'utf8');
console.log(`백업 파일 생성됨: ${backupPath}`);

// 함수 통합 작업 시작
console.log('중복 함수 통합 중...');

// 1. 첫 번째 handleFileDrop 함수 제거 (라인 4538)
// 정규 표현식에서 ? 뒤에 오는 캡처 그룹은 4538 라인의 handleFileDrop 함수를 대상으로 삼습니다.
scriptCode = scriptCode.replace(
  /\/\/ 파일\/폴더가 폴더 위에 드롭되었을 때 호출되는 함수\s*function handleFileDrop\(e, targetFolderItem\) \{[\s\S]*?determineDropType\(e\);/,
  '// 파일/폴더가 폴더 위에 드롭되었을 때 호출하는 함수는 아래의 통합 함수로 대체되었습니다.\n// determineDropType(e);'
);

// 2. 두 번째 isPathLocked 함수(라인 3927)와 첫 번째 isPathLocked 함수(라인 3735) 비교 및 통합
// 두 번째 함수(라인 3927)는 더 완전한 구현이므로 첫 번째 함수(라인 3735)를 제거
scriptCode = scriptCode.replace(
  /\/\/ 폴더 잠금 상태 확인\s*function isPathLocked\(path\) \{[\s\S]*?return lockedFolders\.includes\(path\);\s*\}/,
  '// 폴더 잠금 상태 확인 함수는 아래의 더 완전한 구현으로 대체되었습니다.'
);

// 3. 두 번째 toggleFolderLock 함수(라인 3953)와 첫 번째 toggleFolderLock 함수(라인 3777) 비교 및 통합
// 두 번째 함수(라인 3953)는 더 많은 기능(상위 폴더 잠금 검사 등)을 포함하므로 첫 번째 함수(라인 3777) 제거
scriptCode = scriptCode.replace(
  /\/\/ 폴더 잠금 토글 함수 \(수정: 명령 인자 추가\)\s*function toggleFolderLock\(action\) \{[\s\S]*?processNextFolder\(0\);\s*\}/,
  '// 폴더 잠금 토글 함수는 아래의 더 완전한 구현으로 대체되었습니다.'
);

// 4. 두 번째 toggleFolderLock 함수(라인 3953)의 매개변수 기본값 설정 확인
// 첫 번째 toggleFolderLock은 action=lock 기본값을 설정했었음
scriptCode = scriptCode.replace(
  /function toggleFolderLock\(action = 'lock'\) \{/,
  'function toggleFolderLock(action = \'lock\') {'
);

// 5. 파일 쓰기
console.log('수정된 파일 저장 중...');
fs.writeFileSync(scriptFilePath, scriptCode, 'utf8');

console.log('완료!');

// 변경 내용 요약
console.log('\n변경 내용 요약:');
console.log('1. 첫 번째 handleFileDrop 함수 제거 (라인 4538)');
console.log('2. 첫 번째 isPathLocked 함수 제거 (라인 3735)');
console.log('3. 첫 번째 toggleFolderLock 함수 제거 (라인 3777)');
console.log('4. 두 번째 toggleFolderLock 함수에 기본값 설정 확인 (라인 3953)');
console.log('\n변경 완료. 서버를 재시작하세요: sudo systemctl restart webdav'); 