async function compressSelectedItems() {
    if (selectedItems.size === 0) return;
    
    const selectedItemsArray = Array.from(selectedItems);
    const firstItemName = selectedItemsArray[0];
    
    // 파일 크기 확인 (500MB 제한)
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    let hasLargeFile = false;
    for (const item of selectedItemsArray) {
        const fileInfo = fileInfoMap.get(item);
        if (fileInfo && fileInfo.type === 'file' && fileInfo.size > MAX_FILE_SIZE) {
            hasLargeFile = true;
            break;
        }
    }
    
    if (hasLargeFile) {
        showToast('500MB 이상의 파일이 포함되어 있어 압축할 수 없습니다.', 'error');
        return;
    }
    
    // 기본 압축 파일 이름 설정 (첫 번째 선택 항목 + 날짜시간)
    const now = new Date();
    const dateTimeStr = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    const defaultZipName = `${firstItemName}_${dateTimeStr}`;
    
    // 모달을 통해 압축 파일 이름 입력 받기
    const zipNameWithoutExt = await showCompressModal(defaultZipName);
    if (!zipNameWithoutExt) return; // 사용자가 취소한 경우

    const zipName = `${zipNameWithoutExt}.zip`; // 확장자 추가
    
    showLoading();
    statusInfo.textContent = '압축 중...';
    
    const filesToCompress = selectedItemsArray;
    
    const requestData = {
        files: filesToCompress,
        targetPath: currentPath,
        zipName: zipName // 확장자가 포함된 이름 사용
    };
    
    // --- 추가: 서버에 압축 액션 로그 전송 ---
    const totalCount = filesToCompress.length;
    let logMessage = `[Compress Action] `;
    let sourceSummary = '';
    if (totalCount === 1) {
        // 파일/폴더 정보 가져오기 (UI 요소나 fileInfoMap 사용)
        const itemElement = document.querySelector(`.file-item[data-name="${CSS.escape(filesToCompress[0])}"], .file-item-grid[data-name="${CSS.escape(filesToCompress[0])}"]`);
        const isFolder = itemElement ? itemElement.getAttribute('data-is-folder') === 'true' : false; // UI 기반 추정
        sourceSummary = `'${filesToCompress[0]}' ${isFolder ? '(폴더)' : '(파일)'}`;
    } else {
        // 여러 항목일 경우, 이름 요약 및 개수 표시
        const firstItems = filesToCompress.slice(0, 2).join(', ');
        sourceSummary = `'${firstItems}'${totalCount > 2 ? ` 외 ${totalCount - 2}개` : ''}`;
        // 필요 시 파일/폴더 개수 상세 정보 추가 (아래 주석 참고)
        // let fileCount = 0;
        // let folderCount = 0;
        // filesToCompress.forEach(name => {
        //     const itemElement = document.querySelector(`.file-item[data-name="${CSS.escape(name)}"], .file-item-grid[data-name="${CSS.escape(name)}"]`);
        //     if (itemElement && itemElement.getAttribute('data-is-folder') === 'true') folderCount++;
        //     else fileCount++;
        // });
        // if (folderCount > 0 && fileCount > 0) sourceSummary += ` (폴더 ${folderCount}개, 파일 ${fileCount}개)`;
        // else if (folderCount > 0) sourceSummary += ` (폴더 ${folderCount}개)`;
        // else if (fileCount > 0) sourceSummary += ` (파일 ${fileCount}개)`;
    }
    const targetDir = currentPath || '루트'; // 현재 경로가 비어있으면 루트로 표시
    logMessage += `${sourceSummary} -> '${zipName}'(으)로 압축 (대상 경로: ${targetDir})`;

    fetch(`${API_BASE_URL}/api/log-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: logMessage, level: 'minimal' })
    }).catch(error => console.error('압축 액션 로그 전송 실패:', error));
    // --- 로그 전송 끝 ---

    try {
        const response = await fetch(`${API_BASE_URL}/api/compress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                // JSON 파싱 실패 시 텍스트로 에러 처리
                 const errorText = await response.text();
                 throw new Error(errorText || `HTTP error! status: ${response.status}`);
            }
             throw new Error(errorData.error || '압축 중 오류가 발생했습니다.');
        }

        const data = await response.json();
        statusInfo.textContent = `${filesToCompress.length}개 항목이 ${data.zipFile}로 압축되었습니다.`;
        showToast(`${filesToCompress.length}개 항목 압축 완료: ${data.zipFile}`, 'success');
        // 압축 후 파일 목록 새로고침
        window.currentPath = currentPath || "";
        loadFiles(currentPath);

    } catch (error) {
        logError('압축 실패:', error);
        showToast(`압축 실패: ${error.message}`, 'error');
        statusInfo.textContent = '압축 실패';
    } finally {
        hideLoading();
    }
}
