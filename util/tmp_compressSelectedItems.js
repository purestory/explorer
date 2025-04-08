function compressSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 선택된 파일/폴더 중 첫 번째 항목의 이름 가져오기
    const selectedItemsArray = Array.from(selectedItems);
    const firstItemName = selectedItemsArray[0];
    
    // 파일 크기 확인
    let hasLargeFile = false;
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    
    for (const item of selectedItemsArray) {
        const fileInfo = fileInfoMap.get(item);
        if (fileInfo && fileInfo.type === 'file' && fileInfo.size > MAX_FILE_SIZE) {
            hasLargeFile = true;
            break;
        }
    }
    
    if (hasLargeFile) {
        alert('500MB 이상의 파일이 포함되어 있어 압축할 수 없습니다.');
        return;
    }
    
    // 현재 날짜와 시간을 문자열로 변환
    const now = new Date();
    const dateTimeStr = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    
    // 기본 압축 파일 이름 설정 (첫 번째 선택 항목 + 날짜시간)
    const defaultZipName = `${firstItemName}_${dateTimeStr}`;
    
    // 압축 파일 이름 입력 받기
    const zipName = prompt('압축 파일 이름을 입력하세요:', defaultZipName);
    if (!zipName) return; // 취소한 경우
    
    showLoading();
    statusInfo.textContent = '압축 중...';
    
    // 압축할 파일 목록 생성
    const filesToCompress = selectedItemsArray;
    
    // API 요청 데이터
    const requestData = {
        files: filesToCompress,
        targetPath: currentPath,
        zipName: zipName
    };
    
    // 압축 API 호출
    fetch(`${API_BASE_URL}/api/compress`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '압축 중 오류가 발생했습니다.');
            });
        }
        return response.json();
    })
    .then(data => {
        // 성공 처리
        statusInfo.textContent = `${filesToCompress.length}개 항목이 ${data.zipFile}로 압축되었습니다.`;
        hideLoading();
        
        // 압축 후 파일 목록 새로고침
    // 초기화 시 window.currentPath 설정
    window.currentPath = currentPath || "";
        loadFiles(currentPath);
    })
    .catch(error => {
        // 오류 처리
        console.error('압축 오류:', error);
        statusInfo.textContent = `압축 실패: ${error.message}`;
        alert(`압축 실패: ${error.message}`);
        hideLoading();
    });
}
