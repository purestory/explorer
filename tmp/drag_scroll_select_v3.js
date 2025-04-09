// ===== 자동 스크롤 관련 전역 변수 =====
let autoScrollIntervalId = null;
let scrollDirection = 0;
let currentScrollSpeed = 0;
const scrollZoneHeight = 50;
const minScrollSpeed = 2;
const maxScrollSpeed = 20;

// ===== scrollLoop 함수 (선택 업데이트 호출 추가) =====
function scrollLoop() {
    if (scrollDirection === 0) {
         autoScrollIntervalId = null;
         return;
    }
    const fileListContainer = document.getElementById('fileList');
    if (fileListContainer) {
        fileListContainer.scrollTop += scrollDirection * currentScrollSpeed;
        // 스크롤 후 선택 업데이트 함수 호출
        updateSelectionBasedOnScroll(); 
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

// ===== 스크롤 기반 선택 업데이트 함수 (새로 추가) =====
function updateSelectionBasedOnScroll(ctrlKeyPressed = false) { // ctrlKey 상태 전달 (mousemove에서만 정확)
    const fileList = document.getElementById('fileList');
    const selectionBox = document.getElementById('selectionBox');
    if (!fileList || !selectionBox || selectionBox.style.display === 'none') {
        // 선택 상자가 보이지 않으면 업데이트 불필요
        return; 
    }
    
    // 저장된 시작 클라이언트 좌표 및 스크롤 가져오기
    const startClientX = parseFloat(selectionBox.dataset.startClientX);
    const startClientY = parseFloat(selectionBox.dataset.startClientY);
    const initialScrollTop = parseFloat(selectionBox.dataset.initialScrollTop);
    const initialScrollLeft = parseFloat(selectionBox.dataset.initialScrollLeft || 0);
    
    // 데이터 속성이 유효하지 않으면 중단
    if (isNaN(startClientX) || isNaN(startClientY) || isNaN(initialScrollTop)) {
         return;
    }

    // 현재 선택 상자의 화면상 위치와 크기 가져오기 (fixed 기준)
    const boxRect = selectionBox.getBoundingClientRect();
    const currentClientX_End = boxRect.left + boxRect.width; // 선택 상자 현재 X 끝
    const currentClientY_End = boxRect.top + boxRect.height; // 선택 상자 현재 Y 끝

    // 현재 스크롤 위치
    const currentScrollTop = fileList.scrollTop;
    const currentScrollLeft = fileList.scrollLeft;
    const scrollDiffY = currentScrollTop - initialScrollTop;
    const scrollDiffX = currentScrollLeft - initialScrollLeft;
    
    // 선택 영역의 절대 위치 계산 (컨테이너 내부 좌표)
    // 주의: selectionBox는 fixed이므로, 시작점 좌표와 현재 상자 좌표를 모두 스크롤 고려하여 계산
    const containerRect = fileList.getBoundingClientRect();
    const selectLeft = Math.min(startClientX, boxRect.left) - containerRect.left + fileList.scrollLeft; 
    const selectRight = Math.max(startClientX + parseFloat(selectionBox.style.width || 0), boxRect.left + boxRect.width) - containerRect.left + fileList.scrollLeft;
    const selectTop = Math.min(startClientY, boxRect.top) - containerRect.top + fileList.scrollTop;
    const selectBottom = Math.max(startClientY + parseFloat(selectionBox.style.height || 0), boxRect.top + boxRect.height) - containerRect.top + fileList.scrollTop;

    // 모든 파일 항목들을 순회하면서 선택 영역과 겹치는지 확인
    const items = document.querySelectorAll('.file-item');
    items.forEach(item => {
        if (item.getAttribute('data-parent-dir') === 'true') return;
        const itemRect = item.getBoundingClientRect();
        const itemContainerRect = fileList.getBoundingClientRect();
        const itemLeft = itemRect.left - itemContainerRect.left + fileList.scrollLeft;
        const itemTop = itemRect.top - itemContainerRect.top + fileList.scrollTop;
        const itemRight = itemLeft + itemRect.width;
        const itemBottom = itemTop + itemRect.height;
        const overlap = !(itemRight < selectLeft || itemLeft > selectRight || itemBottom < selectTop || itemTop > selectBottom);
        
        if (overlap) {
            if (!item.classList.contains('selected')) { item.classList.add('selected'); selectedItems.add(item.getAttribute('data-name')); }
        } else if (!ctrlKeyPressed) { // mousemove 에서만 ctrlKey 상태가 정확함
            if (item.classList.contains('selected')) { item.classList.remove('selected'); selectedItems.delete(item.getAttribute('data-name')); }
        }
    });
    
    const gridItems = document.querySelectorAll('.file-item-grid');
    gridItems.forEach(item => {
         if (item.getAttribute('data-parent-dir') === 'true') return;
        const itemRect = item.getBoundingClientRect();
        const itemContainerRect = fileList.getBoundingClientRect();
        const itemLeft = itemRect.left - itemContainerRect.left + fileList.scrollLeft;
        const itemTop = itemRect.top - itemContainerRect.top + fileList.scrollTop;
        const itemRight = itemLeft + itemRect.width;
        const itemBottom = itemTop + itemRect.height;
        const overlap = !(itemRight < selectLeft || itemLeft > selectRight || itemBottom < selectTop || itemTop > selectBottom);
        if (overlap) {
            if (!item.classList.contains('selected')) { item.classList.add('selected'); selectedItems.add(item.getAttribute('data-name')); }
        } else if (!ctrlKeyPressed) {
            if (item.classList.contains('selected')) { item.classList.remove('selected'); selectedItems.delete(item.getAttribute('data-name')); }
        }
    });
    
    updateButtonStates(); // 선택 상태 변경 시 버튼 상태 업데이트
}


// ===== mousedown 핸들러 =====
document.addEventListener('mousedown', (e) => {
    // ... (기존 코드와 동일, 자동 스크롤 중지 등 포함)
    if (e.target.closest('.context-menu') || e.button !== 0 /*...*/) { return; }
    if (autoScrollIntervalId !== null) { cancelAnimationFrame(autoScrollIntervalId); autoScrollIntervalId = null; scrollDirection = 0; }
    const fileList = document.getElementById('fileList'); if (!fileList) return;
    let startClientX = e.clientX; let startClientY = e.clientY;
    const fileItemElement = e.target.closest('.file-item') || e.target.closest('.file-item-grid');
    window.dragSelectState.startedOnFileItem = fileItemElement !== null;
    if (window.dragSelectState.startedOnFileItem && fileItemElement.classList.contains('selected')) { window.dragSelectState.startedOnSelectedItem = true; return; }
    e.preventDefault();
    window.dragSelectState.dragStarted = false;
    const initialScrollTop = fileList.scrollTop; const initialScrollLeft = fileList.scrollLeft;
    window.dragSelectState.isSelecting = true;
    const selectionBox = document.getElementById('selectionBox'); if (!selectionBox) return;
    selectionBox.style.position = 'fixed'; selectionBox.style.left = `${startClientX}px`; selectionBox.style.top = `${startClientY}px`;
    selectionBox.style.width = '0px'; selectionBox.style.height = '0px'; selectionBox.style.display = 'none'; selectionBox.style.zIndex = '9999';
    selectionBox.dataset.startClientX = startClientX; selectionBox.dataset.startY = startClientY;
    selectionBox.dataset.initialScrollTop = initialScrollTop; selectionBox.dataset.initialScrollLeft = initialScrollLeft;
    wasDragging = false;
});


// ===== mousemove 핸들러 (수정됨 - 선택 로직 분리) =====
document.addEventListener('mousemove', (e) => {
    if (window.dragSelectState.startedOnSelectedItem) return;
    if (!window.dragSelectState.isSelecting) return;

    const fileList = document.getElementById('fileList');
    const selectionBox = document.getElementById('selectionBox');
    if (!fileList || !selectionBox) return;
    const rect = fileList.getBoundingClientRect();

    const startClientX = parseFloat(selectionBox.dataset.startClientX);
    const startClientY = parseFloat(selectionBox.dataset.startClientY);
    if (isNaN(startClientX) || isNaN(startClientY) || !selectionBox.dataset.initialScrollTop) { window.dragSelectState.isSelecting = false; selectionBox.style.display = 'none'; return; }
    
    const currentClientX = e.clientX;
    const currentClientY = e.clientY;
    const dragDistance = Math.sqrt(Math.pow(currentClientX - startClientX, 2) + Math.pow(currentClientY - startClientY, 2));

    if (!window.dragSelectState.dragStarted && dragDistance >= minDragDistance) { 
        window.dragSelectState.dragStarted = true; wasDragging = true; selectionBox.style.display = 'block'; 
        if (!e.ctrlKey) { clearSelection(); } // 드래그 시작 시 한 번만 선택 해제
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

    // --- 자동 스크롤 로직 (영역 밖에서도 동작) ---
    const mouseY = e.clientY;
    scrollDirection = 0;
    currentScrollSpeed = 0;
    if (mouseY < rect.top + scrollZoneHeight) {
        scrollDirection = -1; const distance = Math.max(0, mouseY - rect.top);
        currentScrollSpeed = maxScrollSpeed - ((distance / scrollZoneHeight) * (maxScrollSpeed - minScrollSpeed));
        currentScrollSpeed = Math.max(minScrollSpeed, Math.min(maxScrollSpeed, currentScrollSpeed));
    }
    else if (mouseY > rect.bottom - scrollZoneHeight) {
        scrollDirection = 1; const distance = Math.max(0, rect.bottom - mouseY);
        currentScrollSpeed = maxScrollSpeed - ((distance / scrollZoneHeight) * (maxScrollSpeed - minScrollSpeed));
        currentScrollSpeed = Math.max(minScrollSpeed, Math.min(maxScrollSpeed, currentScrollSpeed));
    }
    if (scrollDirection !== 0) {
        if (autoScrollIntervalId === null) { autoScrollIntervalId = requestAnimationFrame(scrollLoop); }
    } else {
        if (autoScrollIntervalId !== null) { cancelAnimationFrame(autoScrollIntervalId); autoScrollIntervalId = null; }
    }
    // --- 자동 스크롤 로직 끝 ---

    // --- 파일 항목 선택 로직 (분리된 함수 호출) ---
    updateSelectionBasedOnScroll(e.ctrlKey); // ctrlKey 상태 전달
    // --- 선택 로직 끝 ---
});


// ===== mouseup 핸들러 =====
document.addEventListener('mouseup', (e) => {
    if (!window.dragSelectState.isSelecting) return;
    // 자동 스크롤 중지
    if (autoScrollIntervalId !== null) { cancelAnimationFrame(autoScrollIntervalId); autoScrollIntervalId = null; scrollDirection = 0; }
    const selectionBox = document.getElementById('selectionBox'); 
    if (selectionBox) { selectionBox.style.display = 'none'; }
    // 상태 초기화
    window.dragSelectState.isSelecting = false;
    window.dragSelectState.dragStarted = false;
    window.dragSelectState.startedOnFileItem = false;
    window.dragSelectState.startedOnSelectedItem = false;
    // 버튼 상태 마지막 업데이트
    updateButtonStates(); 
}); 