function initDragSelect() {
    const fileList = document.getElementById('fileList');
    // 지역 변수 대신 전역 dragSelectState 객체 사용
    const minDragDistance = 5; // 최소 드래그 거리 (픽셀)
    
    // 자동 스크롤 관련 변수 추가
    let autoScrollAnimationId = null;
    const scrollSpeed = 8; // 스크롤 속도 (픽셀/프레임)
    const scrollEdgeSize = 80; // 스크롤 감지 영역 크기 (픽셀)
    
    // 자동 스크롤 함수
    function autoScroll(clientX, clientY) {
        if (!window.dragSelectState.isSelecting || !window.dragSelectState.dragStarted) {
            cancelAutoScroll();
            return;
        }
        
        const rect = fileList.getBoundingClientRect();
        let scrollX = 0;
        let scrollY = 0;
        
        // 수직 스크롤 계산
        if (clientY < rect.top + scrollEdgeSize) {
            // 상단 가장자리 근처에서는 위로 스크롤
            scrollY = -scrollSpeed * (1 - ((clientY - rect.top) / scrollEdgeSize));
        } else if (clientY > rect.bottom - scrollEdgeSize) {
            // 하단 가장자리 근처에서는 아래로 스크롤
            scrollY = scrollSpeed * (1 - ((rect.bottom - clientY) / scrollEdgeSize));
        }
        
        // 수평 스크롤 계산 (필요한 경우)
        if (clientX < rect.left + scrollEdgeSize) {
            // 왼쪽 가장자리 근처에서는 왼쪽으로 스크롤
            scrollX = -scrollSpeed * (1 - ((clientX - rect.left) / scrollEdgeSize));
        } else if (clientX > rect.right - scrollEdgeSize) {
            // 오른쪽 가장자리 근처에서는 오른쪽으로 스크롤
            scrollX = scrollSpeed * (1 - ((rect.right - clientX) / scrollEdgeSize));
        }
        
        // 스크롤 적용
        if (scrollY !== 0) {
            fileList.scrollTop += scrollY;
        }
        if (scrollX !== 0 && fileList.scrollWidth > fileList.clientWidth) {
            fileList.scrollLeft += scrollX;
        }
        
        // 다음 프레임에서 계속 스크롤
        autoScrollAnimationId = requestAnimationFrame(() => autoScroll(clientX, clientY));
    }
    
    // 자동 스크롤 취소 함수
    function cancelAutoScroll() {
        if (autoScrollAnimationId !== null) {
            cancelAnimationFrame(autoScrollAnimationId);
            autoScrollAnimationId = null;
        }
    }
}
