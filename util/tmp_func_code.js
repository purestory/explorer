function handleFileDblClick(e, fileItem) {
    // 이벤트 버블링 방지
    e.preventDefault();
    e.stopPropagation();
    
    // 더블클릭 이벤트가 비활성화된 상태이면 무시
    if (window.doubleClickEnabled === false) {
        logLog('더블클릭 이벤트가 비활성화 상태입니다.');
        return;
    }
    
    const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
    const fileName = fileItem.getAttribute('data-name');
    const isParentDir = fileItem.getAttribute('data-parent-dir') === 'true';
    
    logLog(`더블클릭 이벤트 발생: ${fileName}, 폴더: ${isFolder}, 상위폴더: ${isParentDir}`);
    
    // 폴더 또는 상위 폴더인 경우 탐색 로직 통합
    if (isFolder) {
        // 더블클릭 이벤트를 비활성화하고 탐색 진행
        window.doubleClickEnabled = false;

        let newPath = '';
        if (isParentDir) { // 상위 폴더('. .') 클릭
            // 현재 경로에서 마지막 '/'를 찾아 그 앞부분까지를 새 경로로 설정
            const lastSlashIndex = currentPath.lastIndexOf('/');
            newPath = (lastSlashIndex > 0) ? currentPath.substring(0, lastSlashIndex) : ''; // 루트는 빈 문자열
        } else { // 일반 폴더 클릭
            newPath = currentPath ? `${currentPath}/${fileName}` : fileName;
        }

        // 경로 변경 및 파일 로드
        syncCurrentPath(newPath); // currentPath 업데이트 및 window.currentPath 동기화
        updateHistoryState(newPath); // 브라우저 히스토리 상태 업데이트

        // 이전 이벤트 리스너 제거 (기존 로직 유지 - 필요성 검토 필요)
        const oldFileItems = document.querySelectorAll('.file-item, .file-item-grid');
        oldFileItems.forEach(item => {
            const clonedItem = item.cloneNode(true);
            item.parentNode.replaceChild(clonedItem, item);
        });
        // 파일 목록 로드 전에 마우스 포인터 상태 리셋 (기존 로직 유지)
        document.querySelectorAll('.file-item, .file-item-grid').forEach(item => {
            if (item.classList) {
                item.classList.remove('hover');
            }
        });
        // 마우스 이벤트 강제 발생 (기존 로직 유지 - 필요성 검토 필요)
        setTimeout(() => {
            try {
                if (typeof window.mouseX === 'number' && typeof window.mouseY === 'number') {
                    const mouseEvent = new MouseEvent('mousemove', {
                        bubbles: true, cancelable: true, view: window,
                        clientX: window.mouseX, clientY: window.mouseY
                    });
                    document.dispatchEvent(mouseEvent);
                }
            } catch (error) {
                logError('마우스 이벤트 강제 발생 중 오류:', error);
            }
        }, 350); // 지연 시간 유지

        // 파일 목록 로드
        loadFiles(newPath);
        clearSelection(); // 선택 초기화

        return; // 폴더 탐색 후 함수 종료
    }
    // 파일 처리 로직 (기존과 동일)
    else {
        // 파일 확장자에 따라 처리
        const fileExt = fileName.split('.').pop().toLowerCase();
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
        const encodedPath = encodeURIComponent(filePath);
        
        // 이미지, 비디오, PDF 등 브라우저에서 열 수 있는 파일 형식
        const viewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
                              'mp4', 'webm', 'ogg', 'mp3', 'wav', 
                              'pdf', 'txt', 'html', 'htm', 'css', 'js', 'json', 'xml'];
        
        if (viewableTypes.includes(fileExt)) {
            // 직접 보기 모드로 URL 생성 (view=true 쿼리 파라미터 추가)
            const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}?view=true`;
            // 새 창에서 파일 열기
            window.open(fileUrl, '_blank');
        } else {
            // 다운로드
            downloadFile(fileName);
        }
    }
}
