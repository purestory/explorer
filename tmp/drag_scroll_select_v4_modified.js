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
        // === 스크롤 후 선택 업데이트 함수 호출 ===
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
    // selectionBox가 없거나, 표시되지 않거나, dataset 속성이 없으면 실행 중단
    if (!fileList || !selectionBox || selectionBox.style.display === 'none' || !selectionBox.dataset.startClientX) {
        return; 
    }
    
    // 저장된 시작 클라이언트 좌표 가져오기 (dataset 사용)
    const startClientX = parseFloat(selectionBox.dataset.startClientX);
    const startClientY = parseFloat(selectionBox.dataset.startClientY);
    // 데이터 속성이 유효하지 않으면 중단
    if (isNaN(startClientX) || isNaN(startClientY)) {
         return;
    }

    // 현재 선택 상자의 화면상(fixed) 위치와 크기 가져오기
    const boxRect = selectionBox.getBoundingClientRect();

    // 선택 영역의 절대 위치 계산 (컨테이너 내부 좌표 기준)
    const containerRect = fileList.getBoundingClientRect();
    // 선택 상자의 시작점(mousedown 시점)과 현재 끝점(mousemove/scroll 중)의 min/max를 사용
    const selectLeft = Math.min(startClientX, boxRect.left) - containerRect.left + fileList.scrollLeft;
    const selectRight = Math.max(startClientX, boxRect.left + boxRect.width) - containerRect.left + fileList.scrollLeft;
    const selectTop = Math.min(startClientY, boxRect.top) - containerRect.top + fileList.scrollTop;
    const selectBottom = Math.max(startClientY, boxRect.top + boxRect.height) - containerRect.top + fileList.scrollTop;

    // 모든 파일 항목들 순회 (리스트 뷰와 그리드 뷰 모두)
    const items = fileList.querySelectorAll('.file-item, .file-item-grid');
    items.forEach(item => {
        if (item.getAttribute('data-parent-dir') === 'true') return; // 상위 폴더 제외
        
        // 항목의 절대 위치 계산 (컨테이너 내부 좌표 기준)
        const itemRect = item.getBoundingClientRect();
        const itemContainerRect = fileList.getBoundingClientRect(); // 재계산 필요할 수 있음
        const itemLeft = itemRect.left - itemContainerRect.left + fileList.scrollLeft;
        const itemTop = itemRect.top - itemContainerRect.top + fileList.scrollTop;
        const itemRight = itemLeft + itemRect.width;
        const itemBottom = itemTop + itemRect.height;
        
        // 선택 영역과 항목이 겹치는지 확인 (엄격하지 않은 비교)
        const overlap = !(itemRight < selectLeft || itemLeft > selectRight || itemBottom < selectTop || itemTop > selectBottom);
        const itemName = item.getAttribute('data-name');

        if (overlap) {
            if (!item.classList.contains('selected')) {
                item.classList.add('selected');
                selectedItems.add(itemName);
            }
        } else {
             // Ctrl 키가 눌리지 않았을 때만 선택 해제 (mousemove에서만 정확)
             // 자동 스크롤 중에는 ctrlKeyPressed가 항상 false이므로, 겹치지 않으면 무조건 선택 해제됨.
             if (!ctrlKeyPressed && item.classList.contains('selected')) {
                 item.classList.remove('selected');
                 selectedItems.delete(itemName);
             }
        }
    });
    
    updateButtonStates(); // 선택 상태 변경 시 버튼 상태 업데이트
}

// ===== mousedown 핸들러 =====
document.addEventListener('mousedown', (e) => {
    // 컨텍스트 메뉴 클릭, 오른쪽 버튼 클릭 등 무시
    if (e.target.closest('.context-menu') || e.button !== 0 || e.target.closest('.top-bar-btn, .context-menu-item, #modeToggleBtn')) {
        return;
    }
    // 자동 스크롤 중지
    if (autoScrollIntervalId !== null) { cancelAnimationFrame(autoScrollIntervalId); autoScrollIntervalId = null; scrollDirection = 0; }

    const fileList = document.getElementById('fileList');
    if (!fileList || e.target.id === 'searchInput') return;

    let startClientX = e.clientX;
    let startClientY = e.clientY;

    // 파일/폴더 아이템 위에서 시작했는지 확인
    const fileItemElement = e.target.closest('.file-item') || e.target.closest('.file-item-grid');
    window.dragSelectState.startedOnFileItem = fileItemElement !== null;

    // 선택된 파일 위에서 드래그 시작하는 경우 (파일 이동 시작점)
    if (window.dragSelectState.startedOnFileItem && fileItemElement.classList.contains('selected')) {
        window.dragSelectState.startedOnSelectedItem = true;
        return; // 선택 상자 생성 안 함
    }

    // 빈 공간 클릭 시 드래그 선택 시작 준비
    e.preventDefault(); // 텍스트 선택 등 기본 동작 방지
    window.dragSelectState.dragStarted = false; // 아직 드래그 시작 안 함
    const initialScrollTop = fileList.scrollTop;
    const initialScrollLeft = fileList.scrollLeft;
    window.dragSelectState.isSelecting = true; // 선택 모드 활성화

    // 선택 상자 요소 가져오고 초기화
    const selectionBox = document.getElementById('selectionBox');
    if (!selectionBox) return; // 요소 없으면 중단
    selectionBox.style.position = 'fixed'; // 화면 기준 위치 고정
    selectionBox.style.left = `${startClientX}px`;
    selectionBox.style.top = `${startClientY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'none'; // 아직 보이지 않음
    selectionBox.style.zIndex = '9999'; // 다른 요소 위에 표시
    // 시작 좌표 및 스크롤 정보 저장 (dataset 사용)
    selectionBox.dataset.startClientX = startClientX;
    selectionBox.dataset.startClientY = startClientY;
    selectionBox.dataset.initialScrollTop = initialScrollTop;
    selectionBox.dataset.initialScrollLeft = initialScrollLeft; // 수평 스크롤 정보도 저장

    wasDragging = false; // 드래그 여부 플래그 초기화
});


// ===== mousemove 핸들러 (수정됨 - 선택 로직 분리) =====
document.addEventListener('mousemove', (e) => {
    // 선택된 항목 위에서 시작된 드래그는 무시 (파일 이동 로직)
    if (window.dragSelectState.startedOnSelectedItem) return;
    // 선택 모드가 아니면 무시
    if (!window.dragSelectState.isSelecting) return;

    const fileList = document.getElementById('fileList');
    const selectionBox = document.getElementById('selectionBox');
    if (!fileList || !selectionBox) return;
    const rect = fileList.getBoundingClientRect(); // 파일 목록 영역 정보

    // 시작 좌표 가져오기 (dataset)
    const startClientX = parseFloat(selectionBox.dataset.startClientX);
    const startClientY = parseFloat(selectionBox.dataset.startClientY);
    // 시작 좌표 없으면 오류 상태, 선택 중지
    if (isNaN(startClientX) || isNaN(startClientY) || !selectionBox.dataset.initialScrollTop) {
         window.dragSelectState.isSelecting = false; selectionBox.style.display = 'none'; return;
    }
    
    const currentClientX = e.clientX;
    const currentClientY = e.clientY;
    // 드래그 거리 계산
    const dragDistance = Math.sqrt(Math.pow(currentClientX - startClientX, 2) + Math.pow(currentClientY - startClientY, 2));

    // 최소 거리 이상 움직였을 때 실제 드래그 시작 처리
    if (!window.dragSelectState.dragStarted && dragDistance >= minDragDistance) { 
        window.dragSelectState.dragStarted = true; // 드래그 시작 상태로 변경
        wasDragging = true; // 실제 드래그 발생 플래그
        selectionBox.style.display = 'block'; // 선택 상자 표시
        // Ctrl 키 누르지 않았으면 기존 선택 해제 (드래그 시작 시 한 번만)
        if (!e.ctrlKey) { clearSelection(); } 
    }
    // 아직 드래그가 시작되지 않았으면 이후 로직 실행 안 함
    if (!window.dragSelectState.dragStarted) return;

    // 선택 상자 위치 및 크기 업데이트 (fixed 기준)
    const left = Math.min(currentClientX, startClientX);
    const top = Math.min(currentClientY, startClientY);
    const width = Math.abs(currentClientX - startClientX);
    const height = Math.abs(currentClientY - startClientY);
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;

    // --- 자동 스크롤 로직 (파일 목록 영역 경계 기준) ---
    const mouseY = e.clientY;
    scrollDirection = 0;
    currentScrollSpeed = 0;
    // 위쪽 경계 근처
    if (mouseY < rect.top + scrollZoneHeight) {
        scrollDirection = -1; // 위로 스크롤
        const distance = Math.max(0, rect.top + scrollZoneHeight - mouseY); // 경계로부터의 거리
        // 거리가 가까울수록 빠르게 스크롤 (비선형적 속도 조절)
        currentScrollSpeed = minScrollSpeed + (maxScrollSpeed - minScrollSpeed) * (distance / scrollZoneHeight);
        currentScrollSpeed = Math.min(maxScrollSpeed, currentScrollSpeed);
    }
    // 아래쪽 경계 근처
    else if (mouseY > rect.bottom - scrollZoneHeight) {
        scrollDirection = 1; // 아래로 스크롤
        const distance = Math.max(0, mouseY - (rect.bottom - scrollZoneHeight)); // 경계로부터의 거리
        currentScrollSpeed = minScrollSpeed + (maxScrollSpeed - minScrollSpeed) * (distance / scrollZoneHeight);
        currentScrollSpeed = Math.min(maxScrollSpeed, currentScrollSpeed);
    }
    // 스크롤 방향이 정해졌고, 아직 스크롤 루프가 실행 중이지 않다면 시작
    if (scrollDirection !== 0) {
        if (autoScrollIntervalId === null) { 
            autoScrollIntervalId = requestAnimationFrame(scrollLoop);
        }
    } else { // 스크롤 영역 벗어나면 스크롤 중지
        if (autoScrollIntervalId !== null) { 
            cancelAnimationFrame(autoScrollIntervalId);
            autoScrollIntervalId = null;
        }
    }
    // --- 자동 스크롤 로직 끝 ---

    // --- 파일 항목 선택 로직 (분리된 함수 호출) ---
    updateSelectionBasedOnScroll(e.ctrlKey); // Ctrl 키 상태 전달
    // --- 선택 로직 끝 ---
});


// ===== mouseup 핸들러 =====
document.addEventListener('mouseup', (e) => {
    // 선택 모드가 아니면 무시
    if (!window.dragSelectState.isSelecting) return;
    // 자동 스크롤 중지
    if (autoScrollIntervalId !== null) { cancelAnimationFrame(autoScrollIntervalId); autoScrollIntervalId = null; scrollDirection = 0; }
    const selectionBox = document.getElementById('selectionBox'); 
    if (selectionBox) { selectionBox.style.display = 'none'; } // 선택 상자 숨김
    // 상태 초기화
    window.dragSelectState.isSelecting = false;
    window.dragSelectState.dragStarted = false;
    window.dragSelectState.startedOnFileItem = false;
    window.dragSelectState.startedOnSelectedItem = false;
    // 버튼 상태 마지막 업데이트
    updateButtonStates(); 
});

// ===== 전역 드래그 정리 핸들러 =====
function setupGlobalDragCleanup() {
    // 드래그 상태를 관리하는 플래그 또는 객체를 전역 스코프에 정의
    // 예: window.dragSelectState = { isSelecting: false, dragStarted: false, ... };

    // mouseup 이벤트 리스너 (문서 전체에 적용)
    document.addEventListener('mouseup', (e) => {
        // 현재 드래그 선택 중인지 확인 (isSelecting 플래그 사용)
        if (window.dragSelectState && window.dragSelectState.isSelecting) {
            // 자동 스크롤 중지 (필요한 경우)
            if (autoScrollIntervalId !== null) {
                cancelAnimationFrame(autoScrollIntervalId);
                autoScrollIntervalId = null;
                scrollDirection = 0;
            }

            // 선택 상자 숨기기 및 관련 데이터 정리
            const selectionBox = document.getElementById('selectionBox');
            if (selectionBox) {
                selectionBox.style.display = 'none';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
                // 드래그 시작 정보 제거
                delete selectionBox.dataset.startClientX;
                delete selectionBox.dataset.startClientY;
                delete selectionBox.dataset.initialScrollTop;
                delete selectionBox.dataset.initialScrollLeft; // 수평 스크롤 정보도 제거
            }

            // 드래그 관련 상태 플래그 초기화
            window.dragSelectState.isSelecting = false;
            window.dragSelectState.dragStarted = false;
            window.dragSelectState.startedOnFileItem = false;
            window.dragSelectState.startedOnSelectedItem = false;
            
            // 마지막으로 버튼 상태 업데이트
            updateButtonStates(); 
        }
    }, true); // 캡처 단계에서 실행하여 다른 mouseup보다 먼저 처리될 수 있도록 함
}


// ... (이전/다음 코드 생략) ... 