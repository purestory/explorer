const fs = require('fs');
const path = require('path');

// 수정할 파일 경로
const scriptFilePath = path.join(__dirname, 'frontend', 'script.js');

// 파일 읽기
console.log('원본 파일 읽는 중...');
let scriptCode = fs.readFileSync(scriptFilePath, 'utf8');

// 수정 전 백업 생성
const backupPath = path.join(__dirname, 'frontend', 'script.js.bak2');
fs.writeFileSync(backupPath, scriptCode, 'utf8');
console.log(`백업 파일 생성됨: ${backupPath}`);

// 중복된 handleFileDrop 함수 이름 변경
console.log('중복 함수 수정 중...');

// 중복 함수 위치 찾기
const handleFileDropPositions = [];
let pos = 0;
const regex = /function\s+handleFileDrop\s*\(/g;
let match;

while ((match = regex.exec(scriptCode)) !== null) {
    handleFileDropPositions.push(match.index);
    console.log(`handleFileDrop 함수 발견: 위치 ${match.index}`);
}

if (handleFileDropPositions.length > 1) {
    console.log(`${handleFileDropPositions.length}개의 handleFileDrop 함수 정의 발견`);
    
    // 두 번째 이후 함수 이름 변경
    for (let i = 1; i < handleFileDropPositions.length; i++) {
        const pos = handleFileDropPositions[i];
        const newName = `handleFileDrop_renamed${i}`;
        console.log(`함수 이름 변경: handleFileDrop -> ${newName} (위치: ${pos})`);
        
        // 함수 이름 변경
        const beforePos = scriptCode.substring(0, pos);
        const afterPos = scriptCode.substring(pos);
        
        // 함수 선언 변경
        const replacedAfter = afterPos.replace(/function\s+handleFileDrop\s*\(/, `function ${newName}(`);
        
        // 함수 호출도 변경
        scriptCode = beforePos + replacedAfter;
    }
    
    // 첫 번째 함수에서 잠금 표시 코드 수정
    scriptCode = scriptCode.replace(
        /if \(file\.isFolder && isDirectlyLocked\) \{/g,
        'if (file.name !== ".." && file.isFolder && isDirectlyLocked) {'
    );
    
    // 접근 제한된 폴더에 아이콘 추가하는 코드 주석 처리
    scriptCode = scriptCode.replace(
        /\/\/ 접근 제한된 폴더에 표시 추가\n\s*if \(file\.isFolder && isRestricted\) \{\s*const restrictedIcon[^}]*}\s*fileItem\.appendChild\(restrictedIcon\);\s*}/g,
        `// 접근 제한된 폴더에 표시 추가 - 잠금 표시 사용하지 않음
    if (file.isFolder && isRestricted) {
        // 하위 폴더에는 접근 제한 아이콘 표시하지 않음
        // const restrictedIcon = document.createElement('div');
        // restrictedIcon.className = 'restricted-icon';
        // restrictedIcon.innerHTML = '<i class="fas fa-shield-alt"></i>';
        // fileItem.appendChild(restrictedIcon);
    }`
    );
    
    console.log('파일 저장 중...');
    fs.writeFileSync(scriptFilePath, scriptCode, 'utf8');
    console.log('완료!');
} else {
    console.log('중복 함수가 발견되지 않았습니다.');
} 