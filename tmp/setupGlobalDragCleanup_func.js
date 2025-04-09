// 전역 마우스 업 이벤트 핸들러 추가 - 드래그 상태 정리를 위한 안전장치
function setupGlobalDragCleanup() {
    // 전역 드래그 상태 관리
    window.isDraggingActive = false;
    window._isCleaningDragState = false; // 정리 함수 중복 호출 방지
    
    // 파일 드래그 시작 함수
    window.startFileDrag = function(items) {
        // 이미 드래그 중이면 무시 (혹시 모를 중복 호출 방지)
        if (window.isDraggingActive) return;
        
        window.isDraggingActive = true;
        logLog(`드래그 시작: ${items.size}개 항목 드래그 중`);
    };
    
    // 드래그 상태 정리 함수
    window.clearDragState = function() {
        // 이미 정리 중이면 더 이상 진행하지 않음
        if (window._isCleaningDragState) return;
        
        // 정리 시작 플래그 설정
        window._isCleaningDragState = true;
        logLog('clearDragState: 정리 시작');
        
        // 드래그 상태 플래그 초기화 (파일 이동/업로드 관련)
        window.isDraggingActive = false;
        
        // --- 드래그 선택 내부 상태 변수 초기화 ---
        window.dragSelectState.isSelecting = false;
        window.dragSelectState.dragStarted = false;
        window.dragSelectState.startedOnFileItem = false;
        window.dragSelectState.startedOnSelectedItem = false;
        logLog('clearDragState: 드래그 선택 상태 변수 초기화 완료');
        
        // --- 추가된 코드: 드래그 *선택* 상태 관련 정리 ---
        const selectionBox = document.getElementById('selectionBox');
        if (selectionBox) {
            selectionBox.style.display = 'none';
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
            // 관련 데이터 속성 초기화 (드래그 선택 시작점 정보 제거)
            delete selectionBox.dataset.startClientX;
            delete selectionBox.dataset.startClientY;
            delete selectionBox.dataset.initialScrollTop;
            delete selectionBox.dataset.initialScrollLeft; // 수평 스크롤 정보도 제거
            logLog('clearDragState: 드래그 선택 박스 상태 초기화');
        }
        
        // 자동 스크롤 취소 (함수가 존재하는 경우)
        if (typeof cancelAutoScroll === 'function') {
            cancelAutoScroll();
        }
        
        // --- 추가된 코드 끝 ---
        
        // 모든 dragging 클래스 제거 (파일 이동/업로드 관련)
        const draggingElements = document.querySelectorAll('.dragging');
        if (draggingElements.length > 0) {
            logLog(`clearDragState: ${draggingElements.length}개의 dragging 클래스 제거`);
            draggingElements.forEach(el => el.classList.remove('dragging'));
        }
        
        // 모든 drag-over 클래스 제거 (파일 이동/업로드 관련)
        const dragOverElements = document.querySelectorAll('.drag-over');
        if (dragOverElements.length > 0) {
            logLog(`clearDragState: ${dragOverElements.length}개의 drag-over 클래스 제거`);
            dragOverElements.forEach(el => el.classList.remove('drag-over'));
        }
        
        logLog('clearDragState: 정리 완료');
        
        // 정리 완료 후 플래그 해제 (약간의 시간차를 두어 확실히 마무리)
        setTimeout(() => {
            window._isCleaningDragState = false;
        }, 0); 
    };
    
    // mouseup 이벤트: 드래그 상태 정리의 주된 트리거
    document.addEventListener('mouseup', (e) => {
        // 드래그가 활성화된 상태에서 마우스 버튼이 놓이면 정리
        if (window.isDraggingActive) {
            logLog('mouseup 이벤트 감지: 드래그 상태 정리 시도');
            window.clearDragState();
        }
    }, true);
    
    // mouseleave 이벤트: 마우스가 문서를 벗어날 때 안전장치로 정리
    document.addEventListener('mouseleave', (e) => {
        // 문서 경계를 벗어나는 경우에만 처리
        if (e.target === document.documentElement && window.isDraggingActive) {
            logLog('mouseleave 이벤트 감지: 문서를 벗어남, 드래그 상태 정리 시도');
            window.clearDragState();
        }
    });
}
