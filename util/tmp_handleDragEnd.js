function handleDragEnd() {
    // 전역 드래그 상태 정리 함수 호출
    if (window.clearDragState) {
        console.log('handleDragEnd 호출: 전역 함수로 정리');
        window.clearDragState();
    } else {
        console.log('handleDragEnd 호출: 기본 정리 로직 수행');
        // 모든 dragging 클래스 제거 (선택자 범위 확장)
        document.querySelectorAll('.dragging').forEach(item => {
            item.classList.remove('dragging');
        });
        
        // 모든 drag-over 클래스 제거 (선택자 범위 확장)
        document.querySelectorAll('.drag-over').forEach(item => {
            item.classList.remove('drag-over');
        });
        
        isDragging = false;
    }
}
