function toggleFolderLock(action = 'lock') {
    // 잠금 기능을 사용할 수 없으면 경고 표시
    if (!lockFeatureAvailable) {
        logLog('폴더 잠금 기능을 사용할 수 없습니다.');
        // 기능이 없으므로 아무 메시지도 표시하지 않고 조용히 무시
        return;
    }
    
    // 선택된 폴더 항목들 확인
    const selectedFolders = [];
    
    // 선택된 항목들 중에서 폴더만 필터링
    selectedItems.forEach(itemName => {
        const element = document.querySelector(`.file-item[data-name="${itemName}"]`);
        if (element && element.getAttribute('data-is-folder') === 'true') {
            const folderPath = currentPath ? `${currentPath}/${itemName}` : itemName;
            
            // 상위 폴더가 잠겨있는지 확인 (잠금 동작인 경우)
            if (action === 'lock' && isPathAccessRestricted(folderPath) && !isPathLocked(folderPath)) {
                statusInfo.textContent = `상위 폴더가 잠겨 있어 '${itemName}' 폴더는 잠글 수 없습니다.`;
                return; // 이 폴더는 건너뜀
            }
            
            selectedFolders.push({
                name: itemName,
                path: folderPath,
                isLocked: isPathLocked(folderPath)
            });
        }
    });
    
    if (selectedFolders.length === 0) {
        // 폴더가 선택되지 않았으면 조용히 리턴
                         return;
                     }
                     
    // 처리할 폴더들을 필터링 (선택된 동작에 따라)
    const foldersToProcess = action === 'lock' 
        ? selectedFolders.filter(folder => !folder.isLocked) // 잠금 동작이면 현재 잠기지 않은 폴더만
        : selectedFolders.filter(folder => folder.isLocked); // 해제 동작이면 현재 잠긴 폴더만
    
    if (foldersToProcess.length === 0) {
        if (action === 'lock') {
            statusInfo.textContent = '선택된 모든 폴더가 이미 잠겨 있습니다.';
        } else {
            statusInfo.textContent = '선택된 모든 폴더가 이미 잠금 해제되어 있습니다.';
        }
        return;
    }
    
    showLoading();
    
    // 모든 폴더의 잠금/해제 작업을 순차적으로 처리
    const processNextFolder = (index) => {
        if (index >= foldersToProcess.length) {
            // 모든 폴더 처리 완료
            loadLockStatus().then(() => {
    // 초기화 시 window.currentPath 설정
    window.currentPath = currentPath || "";
                loadFiles(currentPath); // 파일 목록 새로고침
                const actionText = action === 'lock' ? '잠금' : '잠금 해제';
                statusInfo.textContent = `${foldersToProcess.length}개 폴더 ${actionText} 완료`;
                hideLoading();
            });
            return;
        }
        
        const folder = foldersToProcess[index];
        const encodedPath = encodeURIComponent(folder.path);
        
        fetch(`${API_BASE_URL}/api/lock/${encodedPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: action })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`'${folder.name}' 폴더 ${action === 'lock' ? '잠금' : '잠금 해제'} 처리 실패`);
            }
            return response.json();
        })
        .then(data => {
            // 서버에서 건너뛴 경우 처리
            if (data.status === 'skipped') {
                statusInfo.textContent = data.message;
            }
            // 다음 폴더 처리
            processNextFolder(index + 1);
        })
        .catch(error => {
            alert(`오류 발생: ${error.message}`);
            hideLoading();
    // 초기화 시 window.currentPath 설정
    window.currentPath = currentPath || "";
            loadFiles(currentPath);
        });
    };
    
    // 첫 번째 폴더부터 처리 시작
    processNextFolder(0);
}
