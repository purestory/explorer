    window.clearDragState = function() {
        // 이미 정리 중이면 더 이상 진행하지 않음
        if (window._isCleaningDragState) return;
        
        // 정리 시작 플래그 설정
        window._isCleaningDragState = true;
        console.log('clearDragState: 정리 시작');
        
        // 드래그 상태 플래그 초기화 (파일 이동/업로드 관련)
        window.isDraggingActive = false;
        
        // --- 드래그 선택 내부 상태 변수 초기화 ---
        window.dragSelectState.isSelecting = false;
        window.dragSelectState.dragStarted = false;
        window.dragSelectState.startedOnFileItem = false;
        window.dragSelectState.startedOnSelectedItem = false;
        console.log('clearDragState: 드래그 선택 상태 변수 초기화 완료');
        
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
            console.log('clearDragState: 드래그 선택 박스 상태 초기화');
        }
        
        // 자동 스크롤 취소 (함수가 존재하는 경우)
        if (typeof cancelAutoScroll === 'function') {
            cancelAutoScroll();
        }
        
        // --- 추가된 코드 끝 ---
        
        // 모든 dragging 클래스 제거 (파일 이동/업로드 관련)
        /*
        const draggingElements = document.querySelectorAll('.dragging');
        if (draggingElements.length > 0) {
            console.log(`clearDragState: ${draggingElements.length}개의 dragging 클래스 제거`);
            draggingElements.forEach(el => el.classList.remove('dragging'));
        }
        */
        
        // 모든 drag-over 클래스 제거 (파일 이동/업로드 관련)
        const dragOverElements = document.querySelectorAll('.drag-over');
        if (dragOverElements.length > 0) {
            console.log(`clearDragState: ${dragOverElements.length}개의 drag-over 클래스 제거`);
            dragOverElements.forEach(el => el.classList.remove('drag-over'));
        }
        
        console.log('clearDragState: 정리 완료');
        
        // 정리 완료 후 플래그 해제 (약간의 시간차를 두어 확실히 마무리)
        setTimeout(() => {
            window._isCleaningDragState = false;
        }, 0); 
    };
