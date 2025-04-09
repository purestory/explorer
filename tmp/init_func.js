function init() {
    // 마우스 및 키보드 이벤트 핸들러 설정
    setupGlobalDragCleanup();
    
    logLog('WebDAV 파일 탐색기 초기화 시작');
    
    // 모달 초기화
    initModals();
    
    // 드래그 선택 초기화
    initDragSelect();
    
    // 컨텍스트 메뉴 초기화
    initContextMenu();
    
    // 뷰 모드 초기화
    initViewModes();
    
    // 새 폴더 생성 초기화
    initFolderCreation();
    
    // 이름 변경 초기화
    initRenaming();
    
    // 파일 업로드 초기화 (upload.js 기능 사용)
    // initFileUpload(); // 기존 코드 주석 처리
    
    // 대신 업로드 버튼에 클릭 이벤트 추가
    const uploadButton = document.querySelector('.upload-form .btn-success');
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            const fileUploadInput = document.getElementById('fileUpload');
            if (fileUploadInput) {
                fileUploadInput.click(); // 파일 선택 창 열기
                logLog('[Script] 업로드 버튼 클릭 - 파일 선택 대화상자 열기');
            } else {
                logError('[Script] 파일 업로드 입력 요소를 찾을 수 없습니다.');
            }
        });
    } else {
        logError('[Script] 업로드 버튼을 찾을 수 없습니다.');
    }
    
    // upload.js의 초기화 함수 호출
    if (typeof window.initializeUploader === 'function') {
        logLog('[Script] upload.js 초기화 함수 호출');
        window.initializeUploader();
    } else {
        logError('[Script] upload.js의 초기화 함수를 찾을 수 없습니다.');
    }
    
    // 잘라내기/붙여넣기 초기화
    initClipboardOperations();
    
    // 삭제 초기화
    initDeletion();
    
    // 검색 초기화
    initSearch();
    
    logLog('WebDAV 파일 탐색기 초기화됨');
   
   
    // 다운로드 버튼 이벤트 추가
    downloadBtn.addEventListener('click', downloadSelectedItems);
    
    // 새로고침 버튼 이벤트 추가
    document.getElementById('refreshStorageBtn').addEventListener('click', () => {
        loadDiskUsage();
    });
    
    // 초기 파일 목록 로드
    // 초기화 시 window.currentPath 설정
    window.currentPath = currentPath || "";
    loadFiles(currentPath);
    
    // 드롭존 초기화
    initDropZone();
    initShortcuts();
    // 스토리지 정보 로드
}
