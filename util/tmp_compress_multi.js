                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    
    // 현재 폴더명 또는 기본명으로 압축파일명 생성
    const currentFolderName = currentPath ? currentPath.split('/').pop() : 'files';
    const zipName = `${currentFolderName}_${dateTimeStr}.zip`;
    
    // API 요청 데이터
    const requestData = {
        files: itemList,
        targetPath: '',  // 임시 압축 위치는 루트에 생성
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
        // 압축 성공 후 다운로드 시작
        const zipPath = data.zipPath ? `${data.zipPath}/${data.zipFile}` : data.zipFile;
        const encodedZipPath = encodeURIComponent(zipPath);
        const zipUrl = `${API_BASE_URL}/api/files/${encodedZipPath}`;
        
        // 새 창에서 다운로드
        window.open(zipUrl, '_blank');
        
        // 상태 업데이트
        statusInfo.textContent = `${itemList.length}개 항목 압축 다운로드 중...`;
        hideLoading();
        
        // 임시 압축 파일 삭제 (다운로드 시작 후 10초 후)
        setTimeout(() => {
            fetch(`${API_BASE_URL}/api/files/${encodedZipPath}`, {
                method: 'DELETE'
            })
            .then(() => {
                console.log(`임시 압축 파일 삭제됨: ${zipPath}`);
            })
