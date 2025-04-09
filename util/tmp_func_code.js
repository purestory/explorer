function pasteItems() {
    if (clipboardItems.length === 0) return;
    
    // --- 추가된 부분: 'cut' 작업 시 원본 항목 잠금 확인 ---
    if (clipboardOperation === 'cut') {
        const lockedItems = clipboardItems.filter(item => {
            const sourcePath = item.originalPath ? `${item.originalPath}/${item.name}` : item.name;
            // isPathAccessRestricted 함수가 정의되어 있는지 확인
            if (typeof isPathAccessRestricted === 'function') {
                return isPathAccessRestricted(sourcePath);
            } else {
                logWarn("[pasteItems] isPathAccessRestricted function not found. Cannot check lock status.");
                return false; // 함수가 없으면 확인 불가
            }
        });

        if (lockedItems.length > 0) {
            const lockedNames = lockedItems.map(item => item.name).join(', ');
            alert(`다음 잠긴 항목은 이동할 수 없습니다: ${lockedNames}`);
            // 클립보드 상태는 유지하여 사용자가 다른 작업을 시도할 수 있도록 함
            // clipboardItems = []; // 클립보드 비우지 않음
            // clipboardOperation = '';
            // pasteBtn.disabled = true;
            return; // 이동 작업 중단
        }
    }
    // --- 추가된 부분 끝 ---

    const promises = [];
    showLoading();
    statusInfo.textContent = '붙여넣기 중...';
    
    clipboardItems.forEach(item => {
        // 소스 경로 (원본 파일 경로)
        const sourcePath = item.originalPath ? `${item.originalPath}/${item.name}` : item.name;
        // 대상 경로 (현재 경로)
        // 현재 경로가 비어있으면 루트('/') 경로로 처리
        const targetPathBase = (currentPath === '') ? '' : currentPath;
        
        // 경로에 한글이 포함된 경우를 위해 인코딩 처리
        const encodedSourcePath = encodeURIComponent(sourcePath);
        
        if (clipboardOperation === 'cut') {
            logLog(`이동 요청: 소스=${sourcePath}, 대상 경로=${targetPathBase}, 파일명=${item.name}, 현재경로=${currentPath}`);
            
            // 잘라내기는 이름 변경(이동)으로 처리
            promises.push(
                fetch(`${API_BASE_URL}/api/files/${encodedSourcePath}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        newName: item.name,
                        targetPath: targetPathBase
                    })
                })
                .then(response => {
                    // 응답이 정상적이지 않으면 에러 텍스트 추출
                    if (!response.ok) {
                        return response.text().then(text => {
                            throw new Error(text || `${item.name} 이동 실패 (${response.status})`);
                        });
                    }
                    
                    // 이동된 항목 표시에서 'cut' 클래스 제거
                    document.querySelectorAll('.file-item.cut').forEach(el => {
                        el.classList.remove('cut');
                    });
                    
                    return item.name;
                })
            );
        }
    });
    
    Promise.all(promises)
        .then(() => {
            // 클립보드 초기화
            clipboardItems = [];
            clipboardOperation = '';
            pasteBtn.disabled = true;
            document.getElementById('ctxPaste').style.display = 'none';
            
            // 파일 목록 새로고침
    // 초기화 시 window.currentPath 설정
    window.currentPath = currentPath || "";
    loadFiles(currentPath);
            statusInfo.textContent = `${promises.length}개 항목 붙여넣기 완료`;
            hideLoading();
        })

        .catch(error => {
            alert(`오류 발생: ${error.message}`);
            hideLoading();
    // 초기화 시 window.currentPath 설정
    window.currentPath = currentPath || "";
            loadFiles(currentPath);
        });
}
