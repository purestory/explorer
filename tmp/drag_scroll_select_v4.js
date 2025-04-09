// ===== 자동 스크롤 관련 전역 변수 =====
let autoScrollIntervalId = null;
let scrollDirection = 0;
let currentScrollSpeed = 0;
const scrollZoneHeight = 50;
const minScrollSpeed = 2;
const maxScrollSpeed = 20;

// ===== scrollLoop 함수 =====
function scrollLoop() {
    if (scrollDirection === 0) {
         autoScrollIntervalId = null;
         return;
    }
    const fileListContainer = document.getElementById('fileList');
    if (fileListContainer) {
        fileListContainer.scrollTop += scrollDirection * currentScrollSpeed;
    } else {
        if (autoScrollIntervalId !== null) {
            cancelAnimationFrame(autoScrollIntervalId);
            autoScrollIntervalId = null;
            scrollDirection = 0;
        }
        return;
    }
    autoScrollIntervalId = requestAnimationFrame(scrollLoop);
}


// ===== mousedown 핸들러 =====
document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.context-menu') || e.button !== 0 /*... 다른 상호작용 요소 체크 ...*/) { return; }
    if (autoScrollIntervalId !== null) { cancelAnimationFrame(autoScrollIntervalId); autoScrollIntervalId = null; scrollDirection = 0; }
    
    const fileList = document.getElementById('fileList'); 
    if (!fileList) return; 

    let startClientX = e.clientX;
    let startClientY = e.clientY;
    
    const fileItemElement = e.target.closest('.file-item') || e.target.closest('.file-item-grid');
    window.dragSelectState.startedOnFileItem = fileItemElement !== null;
    
    if (window.dragSelectState.startedOnFileItem && fileItemElement.classList.contains('selected')) {
        window.dragSelectState.startedOnSelectedItem = true;
        return; 
    }
    
    e.preventDefault();
    
    window.dragSelectState.dragStarted = false;
    const initialScrollTop = fileList.scrollTop;
    const initialScrollLeft = fileList.scrollLeft; 
    window.dragSelectState.isSelecting = true;
    
    const selectionBox = document.getElementById('selectionBox');
    if (!selectionBox) return; 
    selectionBox.style.position = 'fixed'; 
    selectionBox.style.left = `${startClientX}px`;
    selectionBox.style.top = `${startClientY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'none'; 
    selectionBox.style.zIndex = '9999'; 
    
    selectionBox.dataset.startClientX = startClientX;
    selectionBox.dataset.startClientY = startClientY;
    selectionBox.dataset.initialScrollTop = initialScrollTop;
    selectionBox.dataset.initialScrollLeft = initialScrollLeft; 
    wasDragging = false;
});


// ===== mousemove 핸들러 (수정됨) =====
document.addEventListener('mousemove', (e) => {
    if (window.dragSelectState.startedOnSelectedItem) return;
    if (!window.dragSelectState.isSelecting) return;

    const fileList = document.getElementById('fileList');
    const selectionBox = document.getElementById('selectionBox');
    if (!fileList || !selectionBox) return;
    const rect = fileList.getBoundingClientRect();

    const startClientX = parseFloat(selectionBox.dataset.startClientX);
    const startClientY = parseFloat(selectionBox.dataset.startClientY);
    if (isNaN(startClientX) || isNaN(startClientY) || !selectionBox.dataset.initialScrollTop) {
         window.dragSelectState.isSelecting = false; selectionBox.style.display = 'none'; return;
    }
    const initialScrollTop = parseFloat(selectionBox.dataset.initialScrollTop);
    const initialScrollLeft = parseFloat(selectionBox.dataset.initialScrollLeft || 0);

    const currentClientX = e.clientX;
    const currentClientY = e.clientY;
    const dragDistance = Math.sqrt(Math.pow(currentClientX - startClientX, 2) + Math.pow(currentClientY - startClientY, 2));

    if (!window.dragSelectState.dragStarted && dragDistance >= minDragDistance) { 
        window.dragSelectState.dragStarted = true; 
        wasDragging = true; 
        selectionBox.style.display = 'block'; 
        if (!e.ctrlKey) { clearSelection(); }
    }
    if (!window.dragSelectState.dragStarted) return;

    const left = Math.min(currentClientX, startClientX);
    const top = Math.min(currentClientY, startClientY);
    const width = Math.abs(currentClientX - startClientX);
    const height = Math.abs(currentClientY - startClientY);
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;

    // --- 자동 스크롤 로직 (수정됨 - 영역 밖에서도 동작) ---
    const mouseY = e.clientY;
    scrollDirection = 0;
    currentScrollSpeed = 0;

    // 마우스가 상단 영역 근처 또는 위에 있을 때
    if (mouseY < rect.top + scrollZoneHeight) {
        scrollDirection = -1; 
        const distance = Math.max(0, mouseY - rect.top); 
        currentScrollSpeed = maxScrollSpeed - ((distance / scrollZoneHeight) * (maxScrollSpeed - minScrollSpeed));
        currentScrollSpeed = Math.max(minScrollSpeed, Math.min(maxScrollSpeed, currentScrollSpeed));
    }
    // 마우스가 하단 영역 근처 또는 아래에 있을 때
    else if (mouseY > rect.bottom - scrollZoneHeight) {
        scrollDirection = 1; 
        const distance = Math.max(0, rect.bottom - mouseY);
        currentScrollSpeed = maxScrollSpeed - ((distance / scrollZoneHeight) * (maxScrollSpeed - minScrollSpeed));
        currentScrollSpeed = Math.max(minScrollSpeed, Math.min(maxScrollSpeed, currentScrollSpeed));
    }

    // 스크롤 시작 또는 중지
    if (scrollDirection !== 0) {
        if (autoScrollIntervalId === null) { 
            autoScrollIntervalId = requestAnimationFrame(scrollLoop);
        }
    } else {
        if (autoScrollIntervalId !== null) { 
            cancelAnimationFrame(autoScrollIntervalId);
            autoScrollIntervalId = null;
        }
    }
    // --- 자동 스크롤 로직 끝 ---

    // 파일 항목 선택 로직 (기존과 동일)
    const currentScrollTop = fileList.scrollTop;
    const currentScrollLeft = fileList.scrollLeft;
    const scrollDiffY = currentScrollTop - initialScrollTop;
    const scrollDiffX = currentScrollLeft - initialScrollLeft;
    const selectLeft = Math.min(currentClientX, startClientX) - rect.left + scrollDiffX;
    const selectRight = Math.max(currentClientX, startClientX) - rect.left + scrollDiffX;
    const startY_abs = startClientY - rect.top + initialScrollTop;
    const currentY_abs = currentClientY - rect.top + currentScrollTop;
    const selectTop = Math.min(startY_abs, currentY_abs);
    const selectBottom = Math.max(startY_abs, currentY_abs);
    
    const items = document.querySelectorAll('.file-item');
    items.forEach(item => {
        if (item.getAttribute('data-parent-dir') === 'true') return;
        const itemRect = item.getBoundingClientRect();
        const itemLeft = itemRect.left - rect.left + fileList.scrollLeft;
        const itemTop = itemRect.top - rect.top + fileList.scrollTop;
        const itemRight = itemLeft + itemRect.width;
        const itemBottom = itemTop + itemRect.height;
        const overlap = !(itemRight < selectLeft || itemLeft > selectRight || itemBottom < selectTop || itemTop > selectBottom);
        if (overlap) {
            if (!item.classList.contains('selected')) { item.classList.add('selected'); selectedItems.add(item.getAttribute('data-name')); }
        } else if (!e.ctrlKey) {
            if (item.classList.contains('selected')) { item.classList.remove('selected'); selectedItems.delete(item.getAttribute('data-name')); }
        }
    });
    
    const gridItems = document.querySelectorAll('.file-item-grid');
    gridItems.forEach(item => {
         if (item.getAttribute('data-parent-dir') === 'true') return;
        const itemRect = item.getBoundingClientRect();
        const itemLeft = itemRect.left - rect.left + fileList.scrollLeft;
        const itemTop = itemRect.top - rect.top + fileList.scrollTop;
        const itemRight = itemLeft + itemRect.width;
        const itemBottom = itemTop + itemRect.height;
        const overlap = !(itemRight < selectLeft || itemLeft > selectRight || itemBottom < selectTop || itemTop > selectBottom);
        if (overlap) {
            if (!item.classList.contains('selected')) { item.classList.add('selected'); selectedItems.add(item.getAttribute('data-name')); }
        } else if (!e.ctrlKey) {
            if (item.classList.contains('selected')) { item.classList.remove('selected'); selectedItems.delete(item.getAttribute('data-name')); }
        }
    });
    
    updateButtonStates();
});


// ===== mouseup 핸들러 =====
document.addEventListener('mouseup', (e) => {
    if (!window.dragSelectState.isSelecting) return;
    if (autoScrollIntervalId !== null) { cancelAnimationFrame(autoScrollIntervalId); autoScrollIntervalId = null; scrollDirection = 0; }
    const selectionBox = document.getElementById('selectionBox'); 
    if (selectionBox) { selectionBox.style.display = 'none'; }
    window.dragSelectState.isSelecting = false;
    window.dragSelectState.dragStarted = false;
    window.dragSelectState.startedOnFileItem = false;
    window.dragSelectState.startedOnSelectedItem = false;
    updateButtonStates();
});       


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
