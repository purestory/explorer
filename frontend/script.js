// 전역 변수
// URL 경로에 따라 적절한 API 베이스 URL 설정
const API_BASE_URL = window.location.hostname === 'itsmyzone.iptime.org' ? 
    window.location.origin : window.location.origin;
let currentPath = '';
let selectedItems = new Set();
let clipboardItems = [];
let clipboardOperation = ''; // 'cut' or 'copy'
let isDragging = false;
let startX, startY;
let listView = true; // 기본값을 true로 설정 (목록 보기)
let diskUsage = null;
// 정렬 상태 추가
let sortField = 'name'; // 정렬 필드: name, size, date
let sortDirection = 'asc'; // 정렬 방향: asc, desc
// 파일 정보 저장을 위한 맵 추가
let fileInfoMap = new Map();
// 업로드 함수 호출 카운터 추가
let uploadButtonCounter = 0;
let dragDropCounter = 0;
let dragDropMoveCounter = 0; // 드래그앤드롭 파일 이동 호출 카운터 추가
let uploadSource = ''; // 업로드 소스 추적 ('button' 또는 'dragdrop')
let isHandlingDrop = false; // 드롭 이벤트 중복 처리 방지 플래그 추가
// 폴더 잠금 상태 저장
let lockedFolders = [];
// 폴더 잠금 기능 사용 가능 여부
let lockFeatureAvailable = true;

// 드래그 선택 상태 관련 전역 변수 추가
window.dragSelectState = {
    isSelecting: false,
    dragStarted: false,
    startedOnFileItem: false,
    startedOnSelectedItem: false
};

// 파일 최상단 또는 적절한 전역 스코프에 추가
let wasDragging = false;

// DOM 요소
const fileView = document.getElementById('fileView');
const breadcrumb = document.getElementById('breadcrumb');
const createFolderBtn = document.getElementById('createFolder');
const folderModal = document.getElementById('folderModal');
const folderNameInput = document.getElementById('folderName');
const createFolderConfirmBtn = document.getElementById('createFolderBtn');
const cancelFolderBtn = document.getElementById('cancelFolderBtn');
const fileUploadInput = document.getElementById('fileUpload');
const cutBtn = document.getElementById('cutBtn');
const pasteBtn = document.getElementById('pasteBtn');
const renameBtn = document.getElementById('renameBtn');
const deleteBtn = document.getElementById('deleteBtn');
const renameModal = document.getElementById('renameModal');
const newNameInput = document.getElementById('newName');
const confirmRenameBtn = document.getElementById('confirmRenameBtn');
const cancelRenameBtn = document.getElementById('cancelRenameBtn');
const searchInput = document.getElementById('searchInput');
const loadingOverlay = document.getElementById('loadingOverlay');
const selectionBox = document.getElementById('selectionBox');
const dropZone = document.getElementById('dropZone');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const uploadStatus = document.getElementById('uploadStatus');
const fileList = document.getElementById('fileList');
const contextMenu = document.getElementById('contextMenu');
const statusbar = document.getElementById('statusbar');
const statusInfo = statusbar.querySelector('.status-info');
const selectionInfo = statusbar.querySelector('.selection-info');
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');
const downloadBtn = document.getElementById('downloadBtn');

// UI에서 잘라내기, 붙여넣기, 이름변경 버튼 숨기기
cutBtn.style.display = 'none';
pasteBtn.style.display = 'none';
renameBtn.style.display = 'none';

// 상황에 맞는 버튼 비활성화/활성화 함수
function updateButtonStates() {
    const selectedCount = selectedItems.size;
    
    renameBtn.disabled = selectedCount !== 1;
    deleteBtn.disabled = selectedCount === 0;
    cutBtn.disabled = selectedCount === 0;
    downloadBtn.disabled = selectedCount === 0;
    
    // 붙여넣기 버튼은 클립보드에 항목이 있을 때만 활성화
    pasteBtn.disabled = clipboardItems.length === 0;
    
    // 상태바 업데이트
    selectionInfo.textContent = `${selectedCount}개 선택됨`;
    
    // 컨텍스트 메뉴 항목 업데이트
    document.getElementById('ctxRename').style.display = selectedCount === 1 ? 'flex' : 'none';
    document.getElementById('ctxPaste').style.display = clipboardItems.length > 0 ? 'flex' : 'none';
    document.getElementById('ctxCut').style.display = selectedCount > 0 ? 'flex' : 'none';
    document.getElementById('ctxDelete').style.display = selectedCount > 0 ? 'flex' : 'none';
    document.getElementById('ctxDownload').style.display = selectedCount > 0 ? 'flex' : 'none';
    document.getElementById('ctxOpen').style.display = selectedCount === 1 ? 'flex' : 'none';
}

// 모든 선택 해제
function clearSelection() {
    document.querySelectorAll('.file-item.selected, .file-item-grid.selected').forEach(item => {
        item.classList.remove('selected');
    });
    selectedItems.clear();
    updateButtonStates();
}

// 항목 선택 함수
function selectItem(fileItem) {
    const itemName = fileItem.getAttribute('data-name');
    fileItem.classList.add('selected');
    selectedItems.add(itemName);
    updateButtonStates();
}

// 항목 선택 토글 함수
function toggleSelection(fileItem) {
    const itemName = fileItem.getAttribute('data-name');
    if (fileItem.classList.contains('selected')) {
        fileItem.classList.remove('selected');
        selectedItems.delete(itemName);
    } else {
        fileItem.classList.add('selected');
        selectedItems.add(itemName);
    }
    updateButtonStates();
}

// Shift 키를 이용한 범위 선택 함수
function handleShiftSelect(fileItem) {
    // 구현 예정 - 필요에 따라 추가 가능
    // 현재는 단일 선택으로 처리
    clearSelection();
    selectItem(fileItem);
}

// 모달 초기화
function initModals() {
    // 모달 닫기 버튼
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            folderModal.style.display = 'none';
            renameModal.style.display = 'none';
        });
    });
    
    // 배경 클릭 시 모달 닫기
    window.addEventListener('click', (e) => {
        if (e.target === folderModal) {
            folderModal.style.display = 'none';
        }
        if (e.target === renameModal) {
            renameModal.style.display = 'none';
        }
    });
    
    // ESC 키로 모달 닫기
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (folderModal.style.display === 'flex') {
                folderModal.style.display = 'none';
            }
            if (renameModal.style.display === 'flex') {
                renameModal.style.display = 'none';
            }
        }
    });
}

// 로딩 표시
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// 컨텍스트 메뉴 초기화
function initContextMenu() {
    // 컨텍스트 메뉴 숨기기
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });
    
    // 항목에 대한 컨텍스트 메뉴
    fileView.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        const fileItem = e.target.closest('.file-item');
        if (fileItem) {
            if (!fileItem.classList.contains('selected')) {
                clearSelection();
                selectItem(fileItem);
            }
            
            // 파일 타입에 따라 열기/다운로드 메뉴 표시 조정
            const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
            const ctxOpen = document.getElementById('ctxOpen');
            const ctxDownload = document.getElementById('ctxDownload');
            const ctxLock = document.getElementById('ctxLock'); // 잠금 메뉴 항목
            
            if (isFolder) {
                ctxOpen.innerHTML = '<i class="fas fa-folder-open"></i> 열기';
                ctxDownload.style.display = 'flex'; // 폴더도 다운로드 메뉴 표시
                ctxDownload.innerHTML = '<i class="fas fa-download"></i> 다운로드'; // 폴더도 그냥 다운로드로 표시
                ctxLock.style.display = 'flex'; // 폴더인 경우에만 잠금 메뉴 표시
                
                // 경로 가져오기
                const itemName = fileItem.getAttribute('data-name');
                const itemPath = currentPath ? `${currentPath}/${itemName}` : itemName;
                
                // 잠금 상태에 따라 메뉴 텍스트 변경
                if (isPathLocked(itemPath)) {
                    ctxLock.innerHTML = '<i class="fas fa-unlock"></i> 잠금 해제';
                } else {
                    ctxLock.innerHTML = '<i class="fas fa-lock"></i> 잠금';
                }
            } else {
                ctxOpen.innerHTML = '<i class="fas fa-external-link-alt"></i> 열기';
                ctxDownload.style.display = 'flex';
                ctxDownload.innerHTML = '<i class="fas fa-download"></i> 다운로드'; // 일반 파일은 다운로드로 표시
                ctxLock.style.display = 'none'; // 파일인 경우 잠금 메뉴 숨김
            }
            
            // 압축 메뉴 표시
            document.getElementById('ctxCompress').style.display = 'flex';
            
            // 메뉴 표시
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
            
            // 컨텍스트 메뉴가 화면 밖으로 나가는지 확인
            const menuRect = contextMenu.getBoundingClientRect();
            if (menuRect.right > window.innerWidth) {
                contextMenu.style.left = `${e.pageX - menuRect.width}px`;
            }
            if (menuRect.bottom > window.innerHeight) {
                contextMenu.style.top = `${e.pageY - menuRect.height}px`;
            }
        }
    });
    
    // 빈 공간에 대한 컨텍스트 메뉴
    fileList.addEventListener('contextmenu', (e) => {
        if (e.target === fileList || e.target === fileView) {
            e.preventDefault();
            clearSelection();
            
            // 메뉴 표시 (붙여넣기와 새 폴더 항목)
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
            
            // 필요한 항목만 표시
            document.querySelectorAll('.context-menu-item').forEach(item => {
                item.style.display = 'none';
            });
            document.getElementById('ctxPaste').style.display = clipboardItems.length > 0 ? 'flex' : 'none';
            document.getElementById('ctxNewFolder').style.display = 'flex'; // 새 폴더 항목 표시
            
            // 컨텍스트 메뉴가 화면 밖으로 나가는지 확인
            const menuRect = contextMenu.getBoundingClientRect();
            if (menuRect.right > window.innerWidth) {
                contextMenu.style.left = `${e.pageX - menuRect.width}px`;
            }
            if (menuRect.bottom > window.innerHeight) {
                contextMenu.style.top = `${e.pageY - menuRect.height}px`;
            }
        }
    });
    
    // 컨텍스트 메뉴 항목 클릭 핸들러
    document.getElementById('ctxOpen').addEventListener('click', () => {
        const selectedItem = document.querySelector('.file-item.selected');
        if (!selectedItem) return;
        
        const isFolder = selectedItem.getAttribute('data-is-folder') === 'true';
        const fileName = selectedItem.getAttribute('data-name');
        
        if (isFolder) {
            // 폴더인 경우 열기
            navigateToFolder(fileName);
        } else {
            // 파일인 경우 열기 (브라우저에서 직접 열기)
            openFile(fileName);
        }
    });
    
    document.getElementById('ctxDownload').addEventListener('click', () => {
        downloadSelectedItems();
    });
    
    document.getElementById('ctxCut').addEventListener('click', cutSelectedItems);
    document.getElementById('ctxPaste').addEventListener('click', pasteItems);
    document.getElementById('ctxRename').addEventListener('click', showRenameDialog);
    document.getElementById('ctxDelete').addEventListener('click', deleteSelectedItems);
    
    // 폴더 잠금 토글 이벤트 추가 (수정)
    document.getElementById('ctxLock').addEventListener('click', (e) => {
        // 메뉴 텍스트에서 명령 확인 (잠금 또는 해제)
        const menuText = e.currentTarget.textContent.trim();
        const action = menuText.includes('잠금 해제') ? 'unlock' : 'lock';
        toggleFolderLock(action);
    });
    
    document.getElementById('ctxNewFolder').addEventListener('click', () => {
        // 현재 폴더에 존재하는 파일 목록 확인
        const fileItems = document.querySelectorAll('.file-item');
        const existingNames = Array.from(fileItems).map(item => item.getAttribute('data-name'));
        
        // 기본 폴더명 '새폴더'와 중복되지 않는 이름 찾기
        let defaultName = '새폴더';
        let counter = 1;
        
        while (existingNames.includes(defaultName)) {
            defaultName = `새폴더(${counter})`;
            counter++;
        }
        
        // 기본 폴더명 설정
        folderNameInput.value = defaultName;
        folderModal.style.display = 'flex';
        folderNameInput.focus();
        
        // 모든 텍스트를 선택하여 바로 수정할 수 있게 함
        folderNameInput.select();
    });
    
    // 압축 메뉴 이벤트 추가
    document.getElementById('ctxCompress').addEventListener('click', compressSelectedItems);
}

// 파일 열기 함수 (브라우저에서 직접 열기)
function openFile(fileName) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const encodedPath = encodeURIComponent(filePath);
    
    // 파일 확장자 확인
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    // 브라우저에서 볼 수 있는 파일 확장자
    const viewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
                          'mp4', 'webm', 'ogg', 'mp3', 'wav', 
                          'pdf', 'txt', 'html', 'htm', 'css', 'js', 'json', 'xml'];
    
    // 브라우저에서 볼 수 있는 파일인 경우
    if (viewableTypes.includes(fileExt)) {
        // 직접 보기 모드로 URL 생성 (view=true 쿼리 파라미터 추가)
        const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}?view=true`;
        
        // 새 창에서 열기
        window.open(fileUrl, '_blank');
        statusInfo.textContent = `${fileName} 파일 열기`;
    } else {
        // 브라우저에서 직접 볼 수 없는 파일은 다운로드
        statusInfo.textContent = `${fileName} 다운로드 중...`;
        
        // 다운로드 모드 URL (쿼리 파라미터 없음)
        const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
        
        // 원래 방식으로 복구
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 명시적으로 download 속성 설정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            statusInfo.textContent = `${fileName} 다운로드 완료`;
        }, 1000);
    }
}

// 파일 드래그 선택 초기화
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
    
    // 마우스 이벤트를 document에 연결 (화면 어디서나 드래그 가능하도록)
    document.addEventListener('mousedown', (e) => {
        // 컨텍스트 메뉴, 또는 다른 상호작용 요소에서 시작된 이벤트는 무시
        if (e.target.closest('.context-menu') || e.button !== 0
            || e.target.closest('button') || e.target.closest('input')
            || e.target.closest('select') || e.target.closest('a')
            || e.target.closest('.modal') || e.target.closest('.dropdown-menu')
            || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT'
            || e.target.tagName === 'SELECT' || e.target.tagName === 'A') {
            return;
        }
        
        // 자동 스크롤 취소 (이전에 진행 중인 것이 있다면)
        cancelAutoScroll();
        
        // 초기 클라이언트 좌표 저장 (스크롤 위치와 무관)
        let startClientX = e.clientX;
        let startClientY = e.clientY;
        let originalTarget = e.target;
        
        // 파일 항목 위에서 시작되었는지 확인
        const fileItemElement = e.target.closest('.file-item') || e.target.closest('.file-item-grid');
        window.dragSelectState.startedOnFileItem = fileItemElement !== null;
        
        // 선택된 항목 위에서 시작된 경우 드래그 선택을 하지 않음 (파일 이동 우선)
        if (window.dragSelectState.startedOnFileItem && fileItemElement.classList.contains('selected')) {
            window.dragSelectState.startedOnSelectedItem = true;
            return; // 선택된 항목에서는 드래그 선택을 시작하지 않음
        }
        
        e.preventDefault();
        
        window.dragSelectState.dragStarted = false;
        
        // 초기 스크롤 위치 저장
        const initialScrollTop = fileList.scrollTop;
        const initialScrollLeft = fileList.scrollLeft; // 수평 스크롤 위치도 저장
        
        // Ctrl 키가 눌려있지 않으면 선택 해제 (아직 드래그 시작 전이므로 대기)
        
        window.dragSelectState.isSelecting = true;
        
        // 선택 박스 초기화 (아직 보이지 않음)
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.position = 'fixed'; // fixed로 변경하여 스크롤과 무관하게 함
        selectionBox.style.left = `${startClientX}px`;
        selectionBox.style.top = `${startClientY}px`;
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'none'; // 처음에는 숨김
        selectionBox.style.zIndex = '9999'; // 더 높은 z-index 설정
        
        // 시작 정보 저장
        selectionBox.dataset.startClientX = startClientX;
        selectionBox.dataset.startClientY = startClientY;
        selectionBox.dataset.initialScrollTop = initialScrollTop;
        selectionBox.dataset.initialScrollLeft = initialScrollLeft; // 수평 스크롤 위치도 저장

        // 드래그 플래그 초기화
        wasDragging = false;
    });
    
    // 마우스 이동 이벤트
    document.addEventListener('mousemove', (e) => {
        // 선택된 항목에서 시작된 경우 드래그 선택하지 않음 (파일 이동 우선)
        if (window.dragSelectState.startedOnSelectedItem) return;
        
        if (!window.dragSelectState.isSelecting) return;
        
        const fileList = document.getElementById('fileList');
        const selectionBox = document.getElementById('selectionBox');
        const rect = fileList.getBoundingClientRect();
        
        // 저장된 시작 클라이언트 좌표
        const startClientX = parseFloat(selectionBox.dataset.startClientX);
        const startClientY = parseFloat(selectionBox.dataset.startClientY);
        const initialScrollTop = parseFloat(selectionBox.dataset.initialScrollTop);
        const initialScrollLeft = parseFloat(selectionBox.dataset.initialScrollLeft || 0);
        
        // 현재 클라이언트 좌표
        const currentClientX = e.clientX;
        const currentClientY = e.clientY;
        
        // 이동 거리 계산
        const dragDistanceX = Math.abs(currentClientX - startClientX);
        const dragDistanceY = Math.abs(currentClientY - startClientY);
        const dragDistance = Math.sqrt(dragDistanceX * dragDistanceX + dragDistanceY * dragDistanceY);
        
        // 최소 드래그 거리를 넘으면 드래그 선택 시작
        if (!window.dragSelectState.dragStarted && dragDistance >= minDragDistance) {
            window.dragSelectState.dragStarted = true;
            // 드래그 시작 시 플래그 설정
            wasDragging = true;
            
            // 선택 박스 표시
            selectionBox.style.display = 'block';
            
            // Ctrl 키가 눌려있지 않으면 선택 해제
            if (!e.ctrlKey) {
                clearSelection();
            }
        }
        
        // 드래그가 시작되지 않았으면 더 이상 처리하지 않음
        if (!window.dragSelectState.dragStarted) return;
        
        // 선택 박스 위치 계산 (고정 위치 기반)
        const left = Math.min(currentClientX, startClientX);
        const top = Math.min(currentClientY, startClientY);
        const width = Math.abs(currentClientX - startClientX);
        const height = Math.abs(currentClientY - startClientY);
        
        // 선택 박스 업데이트 (fixed 위치)
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
        
        // 파일 항목 선택 로직 (스크롤 고려)
        // 선택 영역의 절대 좌표 계산 (스크롤 포함)
        const currentScrollTop = fileList.scrollTop;
        const currentScrollLeft = fileList.scrollLeft;
        const scrollDiffY = currentScrollTop - initialScrollTop;
        const scrollDiffX = currentScrollLeft - initialScrollLeft;
        
        // 선택 영역의 절대 위치 계산 (컨테이너 내부 좌표)
        const selectLeft = Math.min(currentClientX, startClientX) - rect.left + scrollDiffX;
        const selectRight = Math.max(currentClientX, startClientX) - rect.left + scrollDiffX;
        
        // 스크롤 방향에 관계없이 선택 영역의 시작과 끝 좌표 계산을 수정
        // 시작 위치의 Y 좌표를 스크롤 시작 위치 기준으로 계산
        const startY_abs = startClientY - rect.top + initialScrollTop;
        // 현재 위치의 Y 좌표를 현재 스크롤 위치 기준으로 계산
        const currentY_abs = currentClientY - rect.top + currentScrollTop;
        
        // 최종 상단/하단 좌표 계산
        const selectTop = Math.min(startY_abs, currentY_abs);
        const selectBottom = Math.max(startY_abs, currentY_abs);
        
        // 자동 스크롤 처리 - requestAnimationFrame 사용
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            
            // 이미 자동 스크롤이 진행 중이 아니면 시작
            if (autoScrollAnimationId === null) {
                autoScroll(e.clientX, e.clientY);
            }
        } else {
            // 마우스가 컨테이너를 벗어나면 자동 스크롤 취소
            cancelAutoScroll();
        }
        
        // 모든 파일 항목들을 순회하면서 선택 영역과 겹치는지 확인
        const items = document.querySelectorAll('.file-item');
        
        items.forEach(item => {
            // 상위 폴더 항목은 건너뜀
            if (item.getAttribute('data-parent-dir') === 'true') {
                return;
            }
            
            // 항목의 위치와 크기 계산 (절대 위치)
            const itemRect = item.getBoundingClientRect();
            const itemLeft = itemRect.left - rect.left + fileList.scrollLeft;
            const itemTop = itemRect.top - rect.top + fileList.scrollTop; // 현재 스크롤 위치 고려
            const itemRight = itemLeft + itemRect.width;
            const itemBottom = itemTop + itemRect.height;
            
            // 겹침 여부 확인 (절대 위치 기준)
            const overlap = !(
                itemRight < selectLeft ||
                itemLeft > selectRight ||
                itemBottom < selectTop ||
                itemTop > selectBottom
            );
            
            // 선택 상태 업데이트
            if (overlap) {
                if (!item.classList.contains('selected')) {
                    item.classList.add('selected');
                    selectedItems.add(item.getAttribute('data-name'));
                }
            } else if (!e.ctrlKey) {
                if (item.classList.contains('selected')) {
                    item.classList.remove('selected');
                    selectedItems.delete(item.getAttribute('data-name'));
                }
            }
        });
        
        // 그리드 뷰 항목도 처리
        const gridItems = document.querySelectorAll('.file-item-grid');
        
        gridItems.forEach(item => {
            // 상위 폴더 항목은 건너뜀
            if (item.getAttribute('data-parent-dir') === 'true') {
                return;
            }
            
            // 항목의 위치와 크기 계산 (절대 위치)
            const itemRect = item.getBoundingClientRect();
            const itemLeft = itemRect.left - rect.left + fileList.scrollLeft;
            const itemTop = itemRect.top - rect.top + fileList.scrollTop; // 현재 스크롤 위치 고려
            const itemRight = itemLeft + itemRect.width;
            const itemBottom = itemTop + itemRect.height;
            
            // 겹침 여부 확인 (절대 위치 기준)
            const overlap = !(
                itemRight < selectLeft ||
                itemLeft > selectRight ||
                itemBottom < selectTop ||
                itemTop > selectBottom
            );
            
            // 선택 상태 업데이트
            if (overlap) {
                if (!item.classList.contains('selected')) {
                    item.classList.add('selected');
                    selectedItems.add(item.getAttribute('data-name'));
                }
            } else if (!e.ctrlKey) {
                if (item.classList.contains('selected')) {
                    item.classList.remove('selected');
                    selectedItems.delete(item.getAttribute('data-name'));
                }
            }
        });
        
        // 선택 버튼 상태 업데이트
        updateButtonStates();
    });
    
    // 마우스 업 이벤트
    document.addEventListener('mouseup', (e) => {
        // 시작 표시가 없거나 드래그 이벤트가 아니면 무시
        if (!window.dragSelectState.isSelecting) return;
        
        // 자동 스크롤 중지
        cancelAutoScroll();
        
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.display = 'none';
        
        // 전역 상태 초기화
        window.dragSelectState.isSelecting = false;
        window.dragSelectState.dragStarted = false;
        window.dragSelectState.startedOnFileItem = false;
        window.dragSelectState.startedOnSelectedItem = false;
        
        // 버튼 상태 업데이트
        updateButtonStates();
    });
}

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
        console.log(`드래그 시작: ${items.size}개 항목 드래그 중`);
    };
    
    // 드래그 상태 정리 함수
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
        const draggingElements = document.querySelectorAll('.dragging');
        if (draggingElements.length > 0) {
            console.log(`clearDragState: ${draggingElements.length}개의 dragging 클래스 제거`);
            draggingElements.forEach(el => el.classList.remove('dragging'));
        }
        
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
    
    // mouseup 이벤트: 드래그 상태 정리의 주된 트리거
    document.addEventListener('mouseup', (e) => {
        // 드래그가 활성화된 상태에서 마우스 버튼이 놓이면 정리
        if (window.isDraggingActive) {
            console.log('mouseup 이벤트 감지: 드래그 상태 정리 시도');
            window.clearDragState();
        }
    }, true);
    
    // mouseleave 이벤트: 마우스가 문서를 벗어날 때 안전장치로 정리
    document.addEventListener('mouseleave', (e) => {
        // 문서 경계를 벗어나는 경우에만 처리
        if (e.target === document.documentElement && window.isDraggingActive) {
            console.log('mouseleave 이벤트 감지: 문서를 벗어남, 드래그 상태 정리 시도');
            window.clearDragState();
        }
    });
}

// 드래그 종료 처리
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

// 단축키 초기화
function initShortcuts() {
    // 이미 초기화되었는지 확인
    if (window.shortcutsInitialized) {
        console.log('단축키가 이미 초기화되어 있습니다. 중복 호출 방지.');
        return;
    }
    
    document.addEventListener('keydown', (e) => {
        // F2: 이름 변경
        if (e.key === 'F2' && selectedItems.size === 1) {
            e.preventDefault();
            showRenameDialog();
        }
        
        // Delete: 선택 항목 삭제
        if (e.key === 'Delete' && selectedItems.size > 0) {
            e.preventDefault();
            deleteSelectedItems();
        }
        
        // Ctrl+A: 모두 선택
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            selectAllItems();
        }
        
        // Ctrl+X: 잘라내기
        if (e.key === 'x' && (e.ctrlKey || e.metaKey) && selectedItems.size > 0) {
            e.preventDefault();
            cutSelectedItems();
        }
        
        // Ctrl+V: 붙여넣기
        if (e.key === 'v' && (e.ctrlKey || e.metaKey) && clipboardItems.length > 0) {
            e.preventDefault();
            pasteItems();
        }
        
        // Escape: 선택 취소
        if (e.key === 'Escape') {
            e.preventDefault();
            clearSelection();
            contextMenu.style.display = 'none';
        }
    });
    
    // 초기화 완료 플래그 설정
    window.shortcutsInitialized = true;
    console.log('단축키 초기화 완료');
}

// 디스크 사용량 가져오기
function loadDiskUsage() {
    showLoading();
    
    fetch(`${API_BASE_URL}/api/disk-usage`)
        .then(response => {
            if (!response.ok) {
                throw new Error('디스크 사용량 정보를 가져오는 데 실패했습니다.');
            }
            return response.json();
        })
        .then(data => {
            diskUsage = data;
            updateStorageInfoDisplay();
            hideLoading();
        })
        .catch(error => {
            console.error('디스크 사용량 정보 로드 오류:', error);
            hideLoading();
        });
}

// 저장소 정보 표시 업데이트
function updateStorageInfoDisplay() {
    if (!diskUsage) return;
    
    const storageInfoText = document.getElementById('storageInfoText');
    
    // 사용 가능한 공간과 전체 공간 계산 (GB 단위로 변환)
    const usedGB = (diskUsage.used / (1024 * 1024 * 1024)).toFixed(2);
    const totalGB = (diskUsage.total / (1024 * 1024 * 1024)).toFixed(2);
    const percentUsed = ((diskUsage.used / diskUsage.total) * 100).toFixed(1);
    
    // 사용량에 따른 상태 클래스 결정
    let statusClass = '';
    if (percentUsed > 90) {
        statusClass = 'danger';
    } else if (percentUsed > 75) {
        statusClass = 'warning';
    }
    
    // HTML 구성
    storageInfoText.innerHTML = `
        <span>${formatFileSize(diskUsage.used)} / ${formatFileSize(diskUsage.total)} (${percentUsed}%)</span>
        <div class="storage-bar-container">
            <div class="storage-bar ${statusClass}" style="width: ${percentUsed}%"></div>
        </div>
    `;
    
    // 상태바에 디스크 사용량 표시 추가
    const statusbar = document.getElementById('statusbar');
    const diskUsageInfo = document.createElement('div');
    diskUsageInfo.className = 'disk-usage-info';
    
    // 이미 있는 디스크 사용량 요소 제거
    const existingDiskInfo = statusbar.querySelector('.disk-usage-info');
    if (existingDiskInfo) {
        statusbar.removeChild(existingDiskInfo);
    }
    
    diskUsageInfo.innerHTML = `
        <div class="disk-usage-text">사용량: ${formatFileSize(diskUsage.used)} / ${formatFileSize(diskUsage.total)} (${percentUsed}%)</div>
        <div class="disk-usage-bar">
            <div class="disk-usage-fill" style="width: ${percentUsed}%"></div>
        </div>
    `;
    
    // 색상 설정
    const fill = diskUsageInfo.querySelector('.disk-usage-fill');
    if (percentUsed > 90) {
        fill.style.backgroundColor = '#dc3545'; // 빨간색
    } else if (percentUsed > 75) {
        fill.style.backgroundColor = '#ffc107'; // 노란색
    }
    
    statusbar.appendChild(diskUsageInfo);
}

// 파일 목록 로드 함수
function loadFiles(path = '') {
    showLoading();
    currentPath = path;
    
    // URL 인코딩 처리
    const encodedPath = path ? encodeURIComponent(path) : '';
    
    // 더블클릭이 가능한지 여부를 나타내는 전역 플래그
    window.doubleClickEnabled = false;
    
    fetch(`${API_BASE_URL}/api/files/${encodedPath}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`상태 ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // 파일 정보 맵 업데이트
            fileInfoMap.clear();
            data.forEach(file => {
                fileInfoMap.set(file.name, {
                    type: file.isFolder ? 'folder' : 'file',
                    size: file.size,
                    modified: file.modifiedTime
                });
            });
            
            // 정렬 적용
            renderFiles(data);
            updateBreadcrumb(path);
            hideLoading();
            
            // 파일 드래그 이벤트 초기화
            initDragAndDrop();
            
            // 상태 업데이트
            statusInfo.textContent = `${data.length}개 항목`;
            
            // 로딩 완료 후 더블클릭 이벤트 활성화 (타이머 시간 증가)
            setTimeout(() => {
                window.doubleClickEnabled = true;
                console.log('더블클릭 이벤트 활성화됨');
            }, 300);
        })
        .catch(error => {
            console.error('Error:', error);
            statusInfo.textContent = `오류: ${error.message}`;
            hideLoading();
            
            // 오류 발생해도 더블클릭 이벤트 활성화
            window.doubleClickEnabled = true;
        });
    
    // 디스크 사용량 로드
    loadDiskUsage();
}

// 파일 정렬 함수
function sortFiles(files) {
    // 먼저 폴더와 파일 분리
    const folders = files.filter(file => file.isFolder);
    const nonFolders = files.filter(file => !file.isFolder);
    
    // 각각 정렬
    folders.sort((a, b) => {
        return compareValues(a, b, sortField, sortDirection);
    });
    
    nonFolders.sort((a, b) => {
        return compareValues(a, b, sortField, sortDirection);
    });
    
    // 폴더가 항상 먼저 오도록 합친다
    return [...folders, ...nonFolders];
}

// 값 비교 함수
function compareValues(a, b, field, direction) {
    let comparison = 0;
    const multiplier = direction === 'desc' ? -1 : 1;
    
    switch(field) {
        case 'name':
            comparison = a.name.localeCompare(b.name, 'ko');
            break;
        case 'size':
            comparison = a.size - b.size;
            break;
        case 'date':
            comparison = new Date(a.modifiedTime) - new Date(b.modifiedTime);
            break;
        default:
            comparison = a.name.localeCompare(b.name, 'ko');
    }
    
    return comparison * multiplier;
}

// 파일 목록 렌더링
function renderFiles(files) {
    // 파일 목록 초기화
    fileView.innerHTML = '';
    
    // 잠금 상태 로드 후 파일 렌더링
    showLoading();
    loadLockStatus()
        .then(() => {
            // 목록 보기인 경우 헤더 추가
            if (listView) {
                // 헤더 추가
                const headerDiv = document.createElement('div');
                headerDiv.className = 'file-list-header';
                headerDiv.innerHTML = `
                    <div class="header-icon"></div>
                    <div class="header-name" data-sort="name">이름 <i class="fas ${sortField === 'name' ? (sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}"></i></div>
                    <div class="header-size" data-sort="size">크기 <i class="fas ${sortField === 'size' ? (sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}"></i></div>
                    <div class="header-date" data-sort="date">수정일 <i class="fas ${sortField === 'date' ? (sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}"></i></div>
                `;
                
                // 헤더 클릭 이벤트 추가
                headerDiv.querySelectorAll('[data-sort]').forEach(headerItem => {
                    headerItem.addEventListener('click', () => {
                        const sortBy = headerItem.getAttribute('data-sort');
                        if (sortField === sortBy) {
                            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                        } else {
                            sortField = sortBy;
                            sortDirection = 'asc';
                        }
                        loadFiles(currentPath);
                    });
                });
                
                fileView.appendChild(headerDiv);
            }
            
            // 파일 컨테이너 추가
            const filesContainer = document.createElement('div');
            filesContainer.id = 'fileList';
            
            // 목록 스타일 설정 (그리드 또는 리스트)
            filesContainer.className = listView ? 'file-list' : 'file-grid';
            fileView.appendChild(filesContainer);
            
            // 정렬된 파일 목록
            const sortedFiles = sortFiles(files);
            
            // 숨김 파일 필터링 (추가된 부분)
            // 이름이 .으로 시작하는 파일은 숨김 파일로 간주
            const visibleFiles = sortedFiles.filter(file => !file.name.startsWith('.'));
            
            // 잠금 상태 디버그 로깅
            console.log('현재 잠금 폴더 목록:', lockedFolders);
            
            // 상위 폴더로 이동 항목 추가 (루트 폴더가 아닌 경우)
            if (currentPath) {
                // 상위 디렉토리 항목 생성
                const parentItem = document.createElement('div');
                parentItem.className = 'file-item parent-dir';
                parentItem.setAttribute('data-id', '..');
                parentItem.setAttribute('data-name', '..');
                parentItem.setAttribute('data-is-folder', 'true');
                parentItem.setAttribute('data-parent-dir', 'true'); // 상위 폴더 표시를 위한 속성 추가
                
                // 아이콘 생성
                const parentIcon = document.createElement('div');
                parentIcon.className = 'file-icon';
                parentIcon.innerHTML = '<i class="fas fa-level-up-alt"></i>';
                
                // 이름 생성
                const parentName = document.createElement('div');
                parentName.className = 'file-name';
                parentName.innerText = '.. (상위 폴더)';
                
                // 빈 세부 정보
                const parentDetails = document.createElement('div');
                parentDetails.className = 'file-details';
                parentDetails.innerHTML = '<div class="file-size">--</div><div class="file-date">--</div>';
                
                // 부모 항목에 추가
                parentItem.appendChild(parentIcon);
                parentItem.appendChild(parentName);
                parentItem.appendChild(parentDetails);
                
                // 클릭 이벤트 추가 - 제거하고 더블클릭 이벤트로만 처리하도록 수정
                // 대신 initFileItem 함수를 통해 다른 파일/폴더와 동일하게 이벤트 처리
                
                // 컨테이너에 추가
                filesContainer.appendChild(parentItem);
                
                // initFileItem 함수 호출
                initFileItem(parentItem);
            }
            
            // 파일 목록 렌더링
            if (visibleFiles.length === 0 && !currentPath) {
                const noFilesDiv = document.createElement('div');
                noFilesDiv.className = 'no-files';
                noFilesDiv.textContent = '파일이 없습니다.';
                filesContainer.appendChild(noFilesDiv);
            } else {
                visibleFiles.forEach(file => {
                    // 파일 항목 생성
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.setAttribute('data-name', file.name);
                    fileItem.setAttribute('data-id', file.name); // ID 속성 추가
                    fileItem.setAttribute('data-is-folder', file.isFolder.toString());
                    fileItem.setAttribute('data-size', file.size);
                    fileItem.setAttribute('data-date', file.modifiedTime);
                    fileItem.setAttribute('draggable', 'true');
                    
                    // 상위 폴더인 경우 (..) 추가 속성 설정
                    if (file.name === '..') {
                        fileItem.setAttribute('data-parent-dir', 'true');
                    }
                    
                    // 파일 경로 계산
                    const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
                    fileItem.setAttribute('data-path', filePath);
                    
                    // 잠금 상태 확인 및 표시 - 직접 잠긴 폴더만 표시
                    const isDirectlyLocked = isPathLocked(filePath);
                    // 접근 제한 (상위 폴더가 잠겨있는 경우) 확인
                    const isRestricted = isPathAccessRestricted(filePath) && !isDirectlyLocked;
                    
                    if (file.isFolder && isDirectlyLocked) {
                        fileItem.classList.add('locked-folder');
                    } else if (file.isFolder && isRestricted) {
                        // fileItem.classList.add('restricted-folder'); // 주석 처리
                    }
                    
                    // 아이콘 생성
                    const fileIcon = document.createElement('div');
                    fileIcon.className = 'file-icon';
                    
                    // 폴더/파일 아이콘 설정
                    if (file.isFolder) {
                        fileIcon.innerHTML = '<i class="fas fa-folder"></i>';
                    } else {
                        const iconClass = getFileIconClass(file.name);
                        fileIcon.innerHTML = `<i class="${iconClass}"></i>`;
                    }
                    
                    // 파일명 생성
                    const fileName = document.createElement('div');
                    fileName.className = 'file-name';
                    fileName.innerText = file.name;
                    
                    // 파일 정보 생성
                    const fileDetails = document.createElement('div');
                    fileDetails.className = 'file-details';
                    
                    // 파일 크기 생성
                    const fileSize = document.createElement('div');
                    fileSize.className = 'file-size';
                    fileSize.innerText = file.isFolder ? '--' : formatFileSize(file.size);
                    
                    // 수정일 생성
                    const fileDate = document.createElement('div');
                    fileDate.className = 'file-date';
                    fileDate.innerText = formatDate(file.modifiedTime);
                    
                    // 파일 정보 추가
                    fileDetails.appendChild(fileSize);
                    fileDetails.appendChild(fileDate);
                    
                    // 파일 항목에 요소 추가
                    fileItem.appendChild(fileIcon);
                    fileItem.appendChild(fileName);
                    fileItem.appendChild(fileDetails);
                    
                    // 잠긴 폴더에 잠금 아이콘 추가
                    if (file.isFolder && isDirectlyLocked) {
                        const lockIcon = document.createElement('div');
                        lockIcon.className = 'lock-icon';
                        lockIcon.innerHTML = '<i class="fas fa-lock"></i>';
                        fileItem.appendChild(lockIcon);
                    }
                    
                    // 접근 제한된 폴더에 표시 추가
                    if (file.isFolder && isRestricted) {
                        const restrictedIcon = document.createElement('div');
                        restrictedIcon.className = 'restricted-icon';
                        restrictedIcon.innerHTML = '<i class="fas fa-shield-alt"></i>';
                        fileItem.appendChild(restrictedIcon);
                    }
                    
                    // 이벤트 리스너 설정
                    fileItem.addEventListener('click', (e) => {
                        if (e.target.classList.contains('rename-input')) return;
                        
                        // 상위 폴더(..)는 선택되지 않도록 처리
                        if (fileItem.getAttribute('data-parent-dir') === 'true') {
                            // 원클릭으로 상위 폴더 이동을 하지 않도록 수정
                            // 대신 handleFileClick 함수로 처리하여 더블클릭 이벤트에서만 이동하도록 함
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                        
                        // 기존 핸들링 계속
                        handleFileClick(e, fileItem);
                    });
                    
                    // 더블클릭 이벤트
                    fileItem.addEventListener('dblclick', (e) => {
                        if (e.target.classList.contains('rename-input')) return;
                        
                        // handleFileDblClick 함수를 사용하여 통합 처리
                        handleFileDblClick(e, fileItem);
                    });
                    
                    // 파일 항목을 목록에 추가
                    filesContainer.appendChild(fileItem);
                });
            }
            
            // 리스트뷰 설정
            if (listView) {
                fileView.classList.add('list-view');
            } else {
                fileView.classList.remove('list-view');
            }
        
            // 상태 정보 업데이트 - 숨김 파일 카운트 포함
            const hiddenCount = sortedFiles.length - visibleFiles.length;
            if (hiddenCount > 0) {
                statusInfo.textContent = `${visibleFiles.length}개 항목 (${hiddenCount}개 숨김 파일 제외)`;
            } else {
                statusInfo.textContent = `${visibleFiles.length}개 항목`;
            }
            
            hideLoading();
        })
        .catch(error => {
            console.error('잠금 상태 로드 오류:', error);
            hideLoading();
            // 오류가 발생해도 파일 목록은 표시
            statusInfo.textContent = '파일 목록 로드 완료 (잠금 상태 오류)';
        });
}



// 파일 크기 포맷
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
}

// 날짜 포맷
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// 경로 표시 업데이트
function updateBreadcrumb(path) {
    const parts = path.split('/').filter(part => part);
    let breadcrumbHTML = '<span data-path="">홈</span>';
    let currentPathBuilt = '';
    
    parts.forEach((part, index) => {
        currentPathBuilt += (index === 0) ? part : `/${part}`;
        breadcrumbHTML += ` / <span data-path="${currentPathBuilt}">${part}</span>`;
    });
    
    breadcrumb.innerHTML = breadcrumbHTML;
    
    // 경로 클릭 이벤트
    breadcrumb.querySelectorAll('span').forEach(span => {
        span.addEventListener('click', () => {
            currentPath = span.getAttribute('data-path');
            // 히스토리 상태 업데이트 추가
            updateHistoryState(currentPath);
            loadFiles(currentPath);
            
            // 선택 초기화
            clearSelection();
        });
    });
}

// 파일 클릭 처리
function handleFileClick(e, fileItem) {
    // 우클릭은 무시 (컨텍스트 메뉴용)
    if (e.button === 2) return;
    
    // 이름 변경 중이면 무시
    if (fileItem.classList.contains('renaming')) return;
    
    // 상위 폴더는 선택 처리하지 않음
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        return;
    }
    
    // Ctrl 또는 Shift 키로 다중 선택
    if (e.ctrlKey) {
        if (fileItem.classList.contains('selected')) {
            fileItem.classList.remove('selected');
            selectedItems.delete(fileItem.getAttribute('data-name'));
        } else {
            fileItem.classList.add('selected');
            selectedItems.add(fileItem.getAttribute('data-name'));
        }
    } else if (e.shiftKey && selectedItems.size > 0) {
        // Shift 키로 범위 선택
        const items = Array.from(document.querySelectorAll('.file-item:not([data-parent-dir="true"])'));
        const firstSelected = items.findIndex(item => item.classList.contains('selected'));
        const currentIndex = items.indexOf(fileItem);
        
        // 범위 설정
        const start = Math.min(firstSelected, currentIndex);
        const end = Math.max(firstSelected, currentIndex);
        
        clearSelection();
        
        for (let i = start; i <= end; i++) {
            items[i].classList.add('selected');
            selectedItems.add(items[i].getAttribute('data-name'));
        }
    } else {
        // 일반 클릭: 단일 선택
        const fileName = fileItem.getAttribute('data-name');
        
        // 모든 선택 해제 후 현재 항목 선택
        clearSelection();
        fileItem.classList.add('selected');
        selectedItems.add(fileName);
    }
    
    updateButtonStates();
}

// 파일 더블클릭 처리
function handleFileDblClick(e, fileItem) {
    // 이벤트 버블링 방지
    e.preventDefault();
    e.stopPropagation();
    
    // 더블클릭 이벤트가 비활성화된 상태이면 무시
    if (window.doubleClickEnabled === false) {
        console.log('더블클릭 이벤트가 비활성화 상태입니다.');
        return;
    }
    
    const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
    const fileName = fileItem.getAttribute('data-name');
    const isParentDir = fileItem.getAttribute('data-parent-dir') === 'true';
    
    console.log(`더블클릭 이벤트 발생: ${fileName}, 폴더: ${isFolder}, 상위폴더: ${isParentDir}`);
    
    // 상위 폴더 처리
    if (isParentDir) {
        // 더블클릭 이벤트를 비활성화하고 탐색 진행
        window.doubleClickEnabled = false;
        navigateToParentFolder();
        return;
    }
    
    if (isFolder) {
        // 폴더로 이동 전에 더블클릭 비활성화
        window.doubleClickEnabled = false;
        // 폴더로 이동
        navigateToFolder(fileName);
    } else {
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

// 폴더 탐색
function navigateToFolder(folderName) {
    let newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    currentPath = newPath;
    
    // 폴더 이동 히스토리 상태 업데이트
    updateHistoryState(currentPath);
    
    // 이전 더블클릭 이벤트 리스너 제거를 위해 기존 파일 항목 캐시
    const oldFileItems = document.querySelectorAll('.file-item, .file-item-grid');
    oldFileItems.forEach(item => {
        const clonedItem = item.cloneNode(true);
        item.parentNode.replaceChild(clonedItem, item);
    });
    
    // 파일 목록 로드 전에 마우스 포인터 상태 리셋
    document.querySelectorAll('.file-item, .file-item-grid').forEach(item => {
        if (item.classList) {
            item.classList.remove('hover');
        }
    });
    
    // 마우스 포인터 위치 재설정을 위한 강제 mousemove 이벤트 등록
    // 파일 목록이 로드된 후 실행하기 위해 타이머 설정
    setTimeout(() => {
        try {
            // 마우스 위치가 있을 경우에만 이벤트 발생
            if (typeof window.mouseX === 'number' && typeof window.mouseY === 'number') {
                // 마우스 이벤트 강제 발생 
                const mouseEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: window.mouseX,
                    clientY: window.mouseY
                });
                document.dispatchEvent(mouseEvent);
            }
        } catch (error) {
            console.error('마우스 이벤트 강제 발생 중 오류:', error);
        }
    }, 350);
    
    // 파일 목록 로드
    loadFiles(newPath);
    
    // 선택 초기화
    clearSelection();
}

// 파일 다운로드
function downloadFile(fileName) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    // 경로에 한글이 포함된 경우를 위해 인코딩 처리
    const encodedPath = encodeURIComponent(filePath);
    const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
    
    // 다운로드 링크를 새 창에서 열기
    window.open(fileUrl, '_blank');
    
    statusInfo.textContent = `${fileName} 다운로드 중...`;
    setTimeout(() => {
        statusInfo.textContent = `${fileName} 다운로드 완료`;
    }, 1000);
}

// 모든 항목 선택
function selectAllItems() {
    clearSelection();
    
    // 상위 폴더(..)를 제외한 모든 항목 선택
    document.querySelectorAll('.file-item:not([data-parent-dir="true"])').forEach(item => {
        item.classList.add('selected');
        selectedItems.add(item.getAttribute('data-name'));
    });
    
    updateButtonStates();
}

// 이름 변경 다이얼로그 표시
function showRenameDialog() {
    if (selectedItems.size !== 1) return;
    
    const selectedItem = document.querySelector('.file-item.selected');
    const currentName = selectedItem.getAttribute('data-name');
    const isFolder = selectedItem.getAttribute('data-is-folder') === 'true';
    
    // 폴더가 아닌 경우 확장자 분리
    let nameWithoutExt = currentName;
    let extension = '';
    
    if (!isFolder && currentName.includes('.')) {
        const lastDotIndex = currentName.lastIndexOf('.');
        nameWithoutExt = currentName.substring(0, lastDotIndex);
        extension = currentName.substring(lastDotIndex);
    }
    
    // 전체 이름을 input에 설정
    newNameInput.value = currentName;
    renameModal.style.display = 'flex';
    newNameInput.focus();
    
    // 파일인 경우 이름 부분만 선택 (확장자 제외)
    if (!isFolder && extension) {
        newNameInput.setSelectionRange(0, nameWithoutExt.length);
    } else {
        // 폴더인 경우 전체 선택
        newNameInput.select();
    }
}


// 선택 항목 잘라내기
function cutSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 이전에 잘라내기 표시된 항목 초기화
    document.querySelectorAll('.file-item.cut').forEach(item => {
        item.classList.remove('cut');
    });
    
    clipboardItems = [];
    
    // 상위 폴더(..)는 제외
    const itemsToProcess = new Set([...selectedItems].filter(itemId => itemId !== '..'));
    
    if (itemsToProcess.size === 0) {
        alert('잘라낼 항목이 없습니다. 상위 폴더는 잘라낼 수 없습니다.');
        return;
    }
    
    // 현재 선택된 항목을 클립보드에 복사
    itemsToProcess.forEach(itemId => {
        const element = document.querySelector(`.file-item[data-id="${itemId}"]`);
        clipboardItems.push({
            name: itemId,
            isFolder: element.getAttribute('data-is-folder') === 'true',
            originalPath: currentPath
        });
        
        // 잘라내기 표시
        element.classList.add('cut');
    });
    
    clipboardOperation = 'cut';
    pasteBtn.disabled = false;
    
    document.getElementById('ctxPaste').style.display = 'flex';
    
    statusInfo.textContent = `${clipboardItems.length}개 항목 잘라내기`;
    
    // 디버그 로그
    console.log('잘라내기 항목:', clipboardItems);
}

// 항목 붙여넣기
function pasteItems() {
    if (clipboardItems.length === 0) return;
    
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
            console.log(`이동 요청: 소스=${sourcePath}, 대상 경로=${targetPathBase}, 파일명=${item.name}, 현재경로=${currentPath}`);
            
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
            loadFiles(currentPath);
            statusInfo.textContent = `${promises.length}개 항목 붙여넣기 완료`;
            hideLoading();
        })
        .catch(error => {
            alert(`오류 발생: ${error.message}`);
            hideLoading();
            loadFiles(currentPath);
        });
}

// 드래그 시작 처리
function handleDragStart(e, fileItem) {
    console.log('드래그 시작:', fileItem.getAttribute('data-name'));

    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }

    // 드래그 데이터 설정
    e.dataTransfer.effectAllowed = 'move';
    
    // 단일 항목 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 내부 파일 드래그임을 표시하는 데이터 추가
    e.dataTransfer.setData('application/webdav-internal', 'true');
    
    // 드래그 중 스타일 적용
    setTimeout(() => {
        document.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.add('dragging');
        });
    }, 0);
    
    isDragging = true;
}



// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    // 파일 리스트에 이벤트 위임 사용 - 동적으로 생성된 파일 항목에도 이벤트 처리
    const fileList = document.getElementById('fileList');
    const fileView = document.getElementById('fileView');
    const dropZone = document.getElementById('dropZone');
    
    if (!fileList || !fileView || !dropZone) {
        console.error('드래그앤드롭 초기화 중 필수 DOM 요소를 찾을 수 없습니다.');
        return;
    }
    
    console.log('초기화 시 드래그 클래스 정리');
    // 페이지 로드 시 이전에 남아있는 드래그 관련 클래스 모두 제거
    document.querySelectorAll('.dragging, .drag-over').forEach(element => {
        element.classList.remove('dragging', 'drag-over');
    });
    
    // 중복 초기화 방지 (이벤트 리스너가 중복 등록되는 것을 방지)
    fileList.removeEventListener('dragstart', handleFileDragStart);
    fileList.removeEventListener('dragend', handleFileDragEnd);
    fileList.removeEventListener('dragenter', handleFileDragEnter);
    fileList.removeEventListener('dragover', handleFileDragOver);
    fileList.removeEventListener('dragleave', handleFileDragLeave);
    fileList.removeEventListener('drop', handleFileDrop);
    
    // 이벤트 핸들러 함수 정의
    function handleFileDragStart(e) {
        // 상위 폴더는 드래그 불가능
        if (e.target.classList.contains('parent-dir') || e.target.closest('.file-item[data-parent-dir="true"]')) {
            e.preventDefault();
            return;
        }
        
        console.log('드래그 시작 - 대상:', e.target.className);
        
        // 파일 항목 요소 찾기
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        // 전역 드래그 상태 변수 설정 - 내부 드래그 플래그 설정
        window.draggingInProgress = true;
        window.draggingStartTime = Date.now();
        
        const fileName = fileItem.getAttribute('data-name');
        console.log('드래그 시작:', fileName);
        
        // 선택되지 않은 항목을 드래그하는 경우, 선택 초기화 후 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }

        // 드래그 중인 항목 개수
        const dragCount = selectedItems.size;
        console.log(`드래그 시작: ${dragCount}개 항목 드래그 중`);
        
        try {
            // 1. JSON 형식으로 드래그 데이터 설정 (파일 경로 포함)
            const draggedItems = Array.from(selectedItems).map(name => {
                return currentPath ? `${currentPath}/${name}` : name;
            });
            
            const jsonData = {
                source: 'internal',
                host: window.location.host,
                timestamp: Date.now(),
                items: draggedItems
            };
            e.dataTransfer.setData('application/json', JSON.stringify(jsonData));
            
            // 2. 내부 드래그 마커 설정 (보안 강화)
            e.dataTransfer.setData('application/x-internal-drag', 'true');

            // 3. 일반 텍스트 데이터로도 저장 (호환성 유지)
            e.dataTransfer.setData('text/plain', draggedItems.join('\n'));
            
            // 4. 드래그 이미지 효과 설정
            if (dragCount > 1) {
                e.dataTransfer.setDragImage(fileItem, 15, 15);
                e.dataTransfer.effectAllowed = 'move';
            }

            console.log('[File Drag Start] 내부 드래그 마커 설정 완료 (json, x-internal-drag)');
            console.log('[File Drag Start] dataTransfer types set:', Array.from(e.dataTransfer.types));

            // 5. 드래그 중인 항목에 시각적 효과 적용
            setTimeout(() => {
                document.querySelectorAll('.file-item.selected').forEach(item => {
                    item.classList.add('dragging');
                });
            }, 0);

        } catch (error) {
            console.error('드래그 시작 중 오류:', error);
            // 기본 정보만이라도 설정
            e.dataTransfer.setData('text/plain', fileName);
        }
    }
    
    function handleFileDragEnd(e) {
        console.log('파일 리스트 dragend 이벤트 발생');
        
        // 보편적인 드래그 상태 정리 함수 호출
        handleDragEnd();
        
        // 드롭존 비활성화
        dropZone.classList.remove('active');
    }
    
// 모든 drag-over 클래스를 제거하는 함수
function clearAllDragOverClasses() {
    document.querySelectorAll('.file-item.drag-over').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleFileDragEnter(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) {
        // 파일 항목이 없으면 모든 강조 제거
        clearAllDragOverClasses();
        return;
    }
    
    // 상위 폴더인 경우 드래그 오버 스타일 적용하지 않음
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        clearAllDragOverClasses();
        return;
    }
    
    // 폴더인 경우에만 처리하고 시각적 표시
    if (fileItem.getAttribute('data-is-folder') === 'true') {
        // 선택된 폴더에 대한 드래그는 무시
        if (fileItem.classList.contains('selected')) {
            console.log('자기 자신이나 하위 폴더에 드래그 불가: ', fileItem.getAttribute('data-name'));
            clearAllDragOverClasses();
            return;
        }
        
        // 다른 폴더들의 강조 제거
        clearAllDragOverClasses();
        
        console.log('드래그 진입:', fileItem.getAttribute('data-name'));
        // 현재 폴더에만 드래그 오버 스타일 적용
        fileItem.classList.add('drag-over');
    } else {
        // 파일인 경우 모든 강조 제거
        clearAllDragOverClasses();
    }
}
    
function handleFileDragOver(e) {
    e.preventDefault(); // 드롭 허용
    e.stopPropagation(); // 이벤트 버블링 방지
    
    const fileItem = e.target.closest('.file-item');
    
    // 파일 항목이 없거나 드래그 타겟이 파일 리스트인 경우
    if (!fileItem || e.target === fileList || e.target === fileView) {
        clearAllDragOverClasses();
        return;
    }
    
    // 상위 폴더인 경우 드래그 오버 처리하지 않음
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.dataTransfer.dropEffect = 'none'; // 드롭 불가능 표시
        clearAllDragOverClasses();
        return;
    }
    
    // 폴더인 경우에만 처리
    if (fileItem.getAttribute('data-is-folder') === 'true') {
        // 선택된 폴더에 대한 드래그는 무시
        if (fileItem.classList.contains('selected')) {
            e.dataTransfer.dropEffect = 'none'; // 드롭 불가능 표시
            clearAllDragOverClasses();
            return;
        }
        
        // 드롭존 비활성화 - 폴더에 드래그할 때는 전체 드롭존이 아닌 폴더 자체에 표시
        if (dropZone) {
            dropZone.classList.remove('active');
        }
        
        // 다른 요소의 강조 모두 제거하고 현재 폴더만 강조
        clearAllDragOverClasses();
        fileItem.classList.add('drag-over');
        
        // 기본 드롭 효과 설정 (드롭 후 판단)
        const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
        e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
    } else {
        // 파일 항목인 경우 모든 강조 제거
        clearAllDragOverClasses();
        e.dataTransfer.dropEffect = 'none'; // 파일에는 드롭 불가
    }
}
    
function handleFileDragLeave(e) {
    // 이 함수는 필요 없음 - dragover 이벤트에서 모든 처리를 수행
    // 빈 함수로 남겨둠
}

// 이벤트 리스너 등록
fileList.addEventListener('dragenter', handleFileDragEnter);
fileList.addEventListener('dragover', handleFileDragOver);
fileList.addEventListener('dragleave', handleFileDragLeave);
fileList.addEventListener('drop', handleFileDrop);

// 전체 영역 드롭존 이벤트 함수들
function handleDropZoneDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    
        // 모든 드래그 이벤트에 대해 드롭존 활성화
        // 드롭 시점에 내부/외부 판단
        if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')) {
            dropZone.classList.add('active');
        }
    }
    
function handleDropZoneDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 모든 드래그 이벤트에 대해 드롭존 유지
        // 드롭 시점에 내부/외부 판단
        if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')) {
            // 기본 드롭 효과 설정 (드롭 후 판단)
            const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
            e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
            dropZone.classList.add('active');
        }
    }
    
function handleDropZoneDragLeave(e) {
        // relatedTarget이 null이거나 dropZone의 자식 요소가 아닌 경우에만 비활성화
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('active');
    }
}

function handleDropZoneDrop(e) {
    console.log('드롭존에 파일 드롭됨');
    preventDefaults(e);
    
    // 드래그 상태 초기화
    window.draggingInProgress = false;
    
    // 내부/외부 파일 판단
    const { isExternalDrop, isInternalDrop, draggedPaths, reason } = determineDropType(e);
    
    // 최종 판단: 외부 파일이 있으면 외부 드롭으로 처리
    if (isExternalDrop) {
        console.log('드롭존 드롭 - 외부 파일 드롭 처리');
        handleExternalFileDrop(e, currentPath);
    } 
    // 내부 파일이라도 경로가 비어있으면 오류 처리
    else if (isInternalDrop && draggedPaths.length > 0) {
        console.log('드롭존 드롭 - 내부 파일 이동 처리:', draggedPaths);
        // 현재 드롭존의 경로로 파일 이동
        handleInternalFileDrop(draggedPaths, { path: currentPath });
    }
    // 판단 불가능한 경우
    else {
        console.log('드롭존 드롭 - 처리할 수 없는 드롭 데이터');
        showToast('처리할 수 없는 드롭 데이터입니다.', 'error');
        }
    }
    
    // 전체 영역 드롭존 이벤트 리스너 등록
    window.removeEventListener('dragenter', handleDropZoneDragEnter);
    window.removeEventListener('dragover', handleDropZoneDragOver);
    window.removeEventListener('dragleave', handleDropZoneDragLeave);
    dropZone.removeEventListener('drop', handleDropZoneDrop);
    
    console.log('드롭존 이벤트 리스너 등록 완료 (handleDrop 이벤트는 initDropZone에서 등록)');
    
    // 개발 모드에서 폴더 항목 CSS 선택자 유효성 확인
    console.log('폴더 항목 개수:', document.querySelectorAll('.file-item[data-is-folder="true"]').length);
}

// 내부 드래그인지 확인하는 함수 (파일 경로 기반 + 기본값은 내부)
function isInternalDrag(e) {
    // 공통 함수를 재사용하여 드래그 타입 판단
    if (!e || !e.dataTransfer) return true; // 기본값은 내부
    
    // 결정적인 외부 파일 증거: File 객체가 존재하면 무조건 외부 파일로 판단
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        return false; // 외부 파일
    }
    
    // 내부 드래그 마커가 있으면 확실한 내부 파일
    if (e.dataTransfer.types.includes('application/x-internal-drag')) {
        return true;
    }

    // 내부 드래그 진행 상태 확인 (전역 변수)
    if (window.draggingInProgress) {
        return true;
    }
    
    // 기본값은 내부로 판단 (확실한 외부 증거가 없으면)
    return true;
}

// 내부 파일 드롭 처리 함수 (실제 이동 로직 구현)
async function handleInternalFileDrop(draggedItemPaths, targetFolderItem) {
    console.log('[Internal Drop] 내부 파일 이동 처리 시작:', draggedItemPaths);

    // 타겟 폴더 경로 결정
    let targetPath = currentPath;
    let targetName = '현재 폴더';
    
    if (targetFolderItem) {
        // 타겟 폴더가 주어진 경우 (파일 항목에 드롭된 경우)
        const folderName = targetFolderItem.getAttribute('data-name');
        targetPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        targetName = folderName;
    }
    
    console.log(`[Internal Drop] 타겟 경로: ${targetPath}, 타겟 이름: ${targetName}`);
    
    // 드래그된 데이터가 유효한지 확인
    if (!Array.isArray(draggedItemPaths) || draggedItemPaths.length === 0) {
        console.error('[Internal Drop] 유효하지 않은 파일 경로 정보');
        showToast('이동할 항목 정보가 유효하지 않습니다.', 'error');
             return;
        }

    // 경로 처리 및 유효성 검사
    const validItemPaths = draggedItemPaths.filter(path => {
        // 경로가 유효한 문자열인지 확인
        if (typeof path !== 'string' || !path.trim()) {
            console.warn('[Internal Drop] 유효하지 않은 경로 제외:', path);
            return false;
        }
        return true;
    });
    
    if (validItemPaths.length === 0) {
        console.error('[Internal Drop] 유효한 경로가 없음');
        showToast('이동할 유효한 항목이 없습니다.', 'error');
        return;
    }
    
    // 경로 처리 및 이름 추출
    const itemsInfo = validItemPaths.map(path => {
        // 경로에서 파일/폴더 이름 추출
        const itemName = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path;
        // 경로에서 부모 경로 추출 (루트는 빈 문자열)
        const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
        
        // fileInfoMap에서 정보 가져오기 (이름으로 조회)
        const itemInfo = fileInfoMap.get(itemName) || null;
        
        return {
            fullPath: path,
            name: itemName,
            parentPath,
            isFolder: itemInfo ? itemInfo.isFolder : false,
            info: itemInfo
        };
    });
    
    console.log('[Internal Drop] 항목 정보:', itemsInfo);
    
    // --- 유효성 검사 시작 ---
    
    // 1. 타겟 폴더가 이동하려는 항목 중 하나인 경우 방지
    if (targetFolderItem) {
        const targetInDraggedItems = itemsInfo.some(item => item.fullPath === targetPath);
        if (targetInDraggedItems) {
            console.warn(`[Internal Drop] 선택된 항목 중 하나인 '${targetName}'(으)로는 이동할 수 없습니다.`);
             showToast(`선택된 항목 중 하나인 '${targetName}'(으)로는 이동할 수 없습니다.`, 'warning');
             return;
        }
    }
    
    // 2. 폴더를 자신의 하위 폴더로 이동하려는 경우 방지
    for (const item of itemsInfo) {
        if (item.isFolder && targetPath.startsWith(item.fullPath + '/')) {
            console.warn(`[Internal Drop] 폴더 '${item.name}'를 자신의 하위 폴더 '${targetName}'(으)로 이동할 수 없습니다.`);
            showToast(`폴더 '${item.name}'를 자신의 하위 폴더 '${targetName}'(으)로 이동할 수 없습니다.`, 'warning');
            return;
        }
    }
    
    // 3. 이미 대상 폴더에 있는 항목 필터링
    const itemsToMove = itemsInfo.filter(item => item.parentPath !== targetPath);
    
    if (itemsToMove.length === 0) {
        console.log('[Internal Drop] 이동할 필요가 있는 항목이 없습니다.');
        showToast('모든 항목이 이미 대상 폴더에 있습니다.', 'info');
        clearSelection();
        return;
    }

    // --- 유효성 검사 끝 ---
    
    // 이동 시작
    console.log(`[Internal Drop] ${itemsToMove.length}개 항목 이동 준비 완료:`, 
                itemsToMove.map(item => item.name));
    
    showLoading();
    try {
        // 실제 항목 이동 (이동할 항목의 전체 경로 배열 전달)
        await moveToFolder(itemsToMove.map(item => item.fullPath), targetPath);
        
        console.log('[Internal Drop] 이동 작업 성공');
        showToast(`${itemsToMove.length}개 항목을 '${targetName}'(으)로 이동했습니다.`, 'success');
        
        // 파일 목록 새로고침 (moveToFolder에서 처리하므로 제거)
        // loadFiles(currentPath);
    } catch (error) {
        console.error('[Internal Drop] 이동 중 오류 발생:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`항목 이동 중 오류: ${errorMessage}`, 'error');
        
        // 오류 발생 시에도 파일 목록 새로고침 (moveToFolder에서 처리하므로 제거)
        // loadFiles(currentPath);
    } finally {
        hideLoading();
        clearSelection(); // 이동 후 선택 해제
    }
}

// 외부 파일 드롭 처리 함수
async function handleExternalFileDrop(e, targetFolderItem = null) { // async 키워드 추가
    if (isHandlingDrop) {
        console.log('이미 드롭 처리 중입니다. 중복 호출 방지.');
        return; // 중복 실행 방지
    }
    isHandlingDrop = true; // 처리 시작 플래그 설정

    try {
        // 진행 중인 업로드가 있는지 확인
        if (progressContainer.style.display === 'block') {
            statusInfo.textContent = '이미 업로드가 진행 중입니다. 완료 후 다시 시도하세요.';
            console.log('이미 진행 중인 업로드가 있어 새 업로드를 취소합니다.');
            return;
        }

        // DataTransferItemList 사용
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) {
            console.log('드롭된 항목이 없습니다.');
            return;
        }

        // 업로드 소스 설정 및 카운터 초기화
        uploadSource = 'dragdrop';
        dragDropCounter = 0;

        let targetPath = currentPath; // 기본 업로드 경로는 현재 경로

        // 타겟 폴더가 지정된 경우 경로 업데이트
        if (targetFolderItem) {
            const targetFolder = targetFolderItem.getAttribute('data-name');
            targetPath = currentPath ? `${currentPath}/${targetFolder}` : targetFolder;
            console.log('외부 파일 드래그 감지: 대상 폴더:', targetFolder);
                    } else {
            console.log('외부 파일 드래그 감지: 현재 경로에 업로드');
        }

        showLoading();
        statusInfo.textContent = '파일 목록을 읽는 중...';

        const filesWithPaths = [];
        const promises = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    promises.push(traverseFileTree(entry, '', filesWithPaths));
                } else {
                    // webkitGetAsEntry가 지원되지 않는 경우 직접 파일 가져오기
                    const file = item.getAsFile();
                    if (file) {
                        filesWithPaths.push({ file, relativePath: file.name });
                    }
                }
            }
        }

        await Promise.all(promises);

        hideLoading();

        if (filesWithPaths.length === 0) {
            statusInfo.textContent = '업로드할 파일을 찾을 수 없습니다.';
            console.log('업로드할 파일이 없습니다.');
            return;
        }

        console.log(`총 ${filesWithPaths.length}개의 파일 수집 완료.`);
        // uploadFiles 함수 호출 시 targetPath 전달
        uploadFiles(filesWithPaths, targetPath); // 수정: targetPath 전달

    } catch (error) {
        hideLoading();
        statusInfo.textContent = '파일 목록 읽기 오류.';
        console.error('파일 트리 탐색 오류:', error);
        alert('파일 목록을 읽는 중 오류가 발생했습니다.');
    } finally {
        isHandlingDrop = false; // 처리 완료 또는 오류 발생 시 플래그 해제
    }
}

// 파일 트리 탐색 함수 (폴더 포함)
function traverseFileTree(entry, path, filesWithPaths) {
    return new Promise((resolve, reject) => {
        // 경로 이름 길이 제한 확인 및 처리
        const maxPathComponentLength = 220; // 경로 구성요소의 최대 길이 설정
        const maxFullPathLength = 3800; // 전체 경로 최대 길이 (바이트)
        const originalEntryName = entry.name;
        let entryName = originalEntryName;
        
        // 폴더나 파일 이름이 너무 길면 처리
        if (new TextEncoder().encode(entryName).length > maxPathComponentLength) {
            // 폴더인 경우 확장자가 없으므로 단순히 잘라서 처리
            if (entry.isDirectory) {
                // 바이트 단위로 자르기
                let shortName = '';
                const encodedName = new TextEncoder().encode(entryName);
                const maxBytes = maxPathComponentLength - 3; // "..." 공간 확보
                
                // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                let byteCount = 0;
                for (let i = 0; i < entryName.length; i++) {
                    const charBytes = new TextEncoder().encode(entryName[i]).length;
                    if (byteCount + charBytes <= maxBytes) {
                        shortName += entryName[i];
                        byteCount += charBytes;
                    } else {
                        break;
                    }
                }
                
                entryName = shortName + '...';
                console.log(`폴더명이 너무 깁니다. 원본: ${originalEntryName}, 수정됨: ${entryName}`);
            }
            // 파일인 경우는 아래에서 별도 처리
        }

        // 현재 경로 계산
        const currentPath = path ? `${path}/${entryName}` : entryName;
        
        // 전체 경로가 너무 길어질 가능성이 있는지 확인 (바이트 단위로 정확히 계산)
        const pathBytes = new TextEncoder().encode(currentPath).length;
        if (pathBytes > maxFullPathLength / 2) {
            console.warn(`경로가 길어질 가능성이 있습니다: ${currentPath} (${pathBytes} bytes)`);
        }

        if (entry.isFile) {
            entry.file(file => {
                // 숨김 파일 (.으로 시작)은 제외
                if (!file.name.startsWith('.')) {
                    // 파일 이름 길이 체크 및 처리
                    const maxFileNameLength = 220; // 최대 파일명 바이트 길이 설정
                    let fileName = file.name;
                    let relativePath = currentPath;
                    
                    // 파일명 바이트 길이 계산
                    const fileNameBytes = new TextEncoder().encode(fileName).length;
                    
                    // 파일명이 너무 길면 잘라내기
                    if (fileNameBytes > maxFileNameLength) {
                        const extension = fileName.lastIndexOf('.') > 0 ? fileName.substring(fileName.lastIndexOf('.')) : '';
                        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.') > 0 ? fileName.lastIndexOf('.') : fileName.length);
                        
                        // 바이트 기준으로 이름 자르기
                        let shortName = '';
                        const maxBytes = maxFileNameLength - new TextEncoder().encode(extension).length - 3; // "..." 공간 확보
                        
                        // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                        let byteCount = 0;
                        for (let i = 0; i < fileNameWithoutExt.length; i++) {
                            const charBytes = new TextEncoder().encode(fileNameWithoutExt[i]).length;
                            if (byteCount + charBytes <= maxBytes) {
                                shortName += fileNameWithoutExt[i];
                                byteCount += charBytes;
                            } else {
                                break;
                            }
                        }
                        
                        const newFileName = shortName + '...' + extension;
                        
                        // 상대 경로도 수정
                        if (path) {
                            relativePath = `${path}/${newFileName}`;
                        } else {
                            relativePath = newFileName;
                        }
                        
                        console.log(`파일명이 너무 깁니다. 원본: ${fileName}, 수정됨: ${newFileName}`);
                        
                        // 파일 객체를 새로운 이름으로 복제 (File 객체는 직접 수정할 수 없음)
                        const renamedFile = new File([file], newFileName, { type: file.type });
                        filesWithPaths.push({ file: renamedFile, relativePath: relativePath });
                    } else {
                        // 전체 경로 바이트 길이 확인 (UTF-8)
                        const fullPathBytes = new TextEncoder().encode(relativePath).length;
                        
                        if (fullPathBytes > maxFullPathLength) {
                            // 경로가 너무 길면 비상 처리 (파일만 남기고 경로 단축)
                            console.warn(`전체 경로가 너무 깁니다(${fullPathBytes} bytes): ${relativePath}`);
                            
                            // 파일명만 보존하고 경로는 압축
                            const shortenedPath = `긴경로/${fileName}`;
                            console.log(`경로 단축됨: ${relativePath} → ${shortenedPath}`);
                            
                            // 중요: 원본 파일 이름은 유지하되 경로만 변경
                            filesWithPaths.push({ file: file, relativePath: shortenedPath });
                            statusInfo.textContent = `일부 파일의 경로가 너무 길어 단축되었습니다.`;
                        } else {
                            // 정상 경로
                            filesWithPaths.push({ file: file, relativePath: relativePath });
                            console.log(`파일 추가: ${relativePath}`);
                        }
                    }
                } else {
                    console.log(`숨김 파일 제외: ${currentPath}`);
                }
                resolve();
            }, err => {
                console.error(`파일 읽기 오류 (${currentPath}):`, err);
                reject(err); // 오류 발생 시 reject 호출
            });
        } else if (entry.isDirectory) {
            // 숨김 폴더 (.으로 시작)는 제외
            if (entry.name.startsWith('.')) {
                console.log(`숨김 폴더 제외: ${currentPath}`);
                resolve(); // 숨김 폴더는 처리하지 않고 resolve
                return;
            }
    
            // 전체 경로 바이트 길이 확인 (UTF-8)
            const fullPathBytes = new TextEncoder().encode(currentPath).length;
            
            if (fullPathBytes > maxFullPathLength) {
                console.warn(`폴더 경로가 너무 깁니다(${fullPathBytes} bytes). 접근 가능한 경로로 단축: ${currentPath}`);
                statusInfo.textContent = `일부 폴더의 경로가 너무 길어 단축되었습니다.`;
                
                // 폴더명 단축 버전 생성 (폴더명 앞부분 + "..." 형태로)
                // UTF-8 바이트 길이를 고려하여 자름
                let shortName = '';
                const maxBytes = 20; // 짧게 유지
                
                // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                let byteCount = 0;
                for (let i = 0; i < entry.name.length; i++) {
                    const charBytes = new TextEncoder().encode(entry.name[i]).length;
                    if (byteCount + charBytes <= maxBytes) {
                        shortName += entry.name[i];
                        byteCount += charBytes;
                    } else {
                        break;
                    }
                }
                
                const shortenedDirName = shortName + "...";
                const shortenedPath = path ? `${path}/${shortenedDirName}` : shortenedDirName;
                
                console.log(`폴더 경로 단축됨: ${currentPath} → ${shortenedPath}`);
                
                // 단축된 경로로 계속 진행
                const dirReader = entry.createReader();
                let allEntries = [];

                const readEntries = () => {
                    dirReader.readEntries(entries => {
                        if (entries.length === 0) {
                            // 모든 항목을 읽었으면 재귀 호출 실행
                            Promise.all(allEntries.map(subEntry => {
                                return traverseFileTree(subEntry, shortenedPath, filesWithPaths);
                            }))
                                .then(resolve)
                                .catch(reject);
        } else {
                            // 읽은 항목을 allEntries에 추가하고 계속 읽기
                            allEntries = allEntries.concat(entries);
                            readEntries();
                        }
                    }, err => {
                        console.error(`폴더 읽기 오류 (${shortenedPath}):`, err);
                        reject(err);
                    });
                };
                readEntries();
         return;
    }
        
    console.log(`폴더 탐색: ${currentPath}`);
    const dirReader = entry.createReader();
    let allEntries = [];

    const readEntries = () => {
        dirReader.readEntries(entries => {
            if (entries.length === 0) {
                // 모든 항목을 읽었으면 재귀 호출 실행
                Promise.all(allEntries.map(subEntry => {
                    // 원본 entry 이름이 변경된 경우 하위 항목의 상대 경로 계산에도 적용
                    const subPath = originalEntryName !== entryName ? 
                        (currentPath) : 
                        (path ? `${path}/${entry.name}` : entry.name);
                    return traverseFileTree(subEntry, subPath, filesWithPaths);
                }))
                    .then(resolve)
                    .catch(reject); // 하위 탐색 중 오류 발생 시 reject
            } else {
                // 읽은 항목을 allEntries에 추가하고 계속 읽기
                allEntries = allEntries.concat(entries);
                readEntries(); // 재귀적으로 호출하여 모든 항목 읽기
            }
        }, err => {
            console.error(`폴더 읽기 오류 (${currentPath}):`, err);
            reject(err); // 폴더 읽기 오류 시 reject
        });
    };
    readEntries();
} else {
    console.warn(`알 수 없는 항목 타입: ${entry.name}`);
    resolve(); // 알 수 없는 타입은 무시하고 resolve
}
});
}


// 특정 폴더에 파일 업로드 (files 인자 변경: File[] -> { file: File, relativePath: string }[])
// targetUploadPath 인자 추가
function uploadFiles(filesWithPaths, targetUploadPath = currentPath) {
    if (!filesWithPaths || filesWithPaths.length === 0) return;

    // 호출 카운터 증가 - 오직 새로운 업로드 세션에서만 증가
    // uploadSource는 handleExternalFileDrop 또는 파일 입력 변경 리스너에서 설정됨
    if (uploadSource === 'button') {
        uploadButtonCounter++;
        console.log(`버튼 업로드 호출 횟수: ${uploadButtonCounter}, 파일 수: ${filesWithPaths.length}`);
        statusInfo.textContent = `버튼 업로드 호출 횟수: ${uploadButtonCounter}, 파일 수: ${filesWithPaths.length}`;
    } else if (uploadSource === 'dragdrop') {
        dragDropCounter++;
        console.log(`드래그앤드롭 업로드 호출 횟수: ${dragDropCounter}, 파일 수: ${filesWithPaths.length}`);
        statusInfo.textContent = `드래그앤드롭 업로드 호출 횟수: ${dragDropCounter}, 파일 수: ${filesWithPaths.length}`;
    }

    // 진행 중 업로드가 있으면 종료 처리
    if (progressContainer.style.display === 'block') {
        console.log('이미 진행 중인 업로드가 있어 새 업로드를 취소합니다.');
            return;
        }

    // 업로드 UI 표시
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    // 전체 파일 크기와 현재까지 업로드된 크기를 추적
    const totalFiles = filesWithPaths.length;
    let totalSize = 0;
    let currentFileIndex = 0; // 현재 처리 중인 파일 인덱스

    // 모든 파일 정보 배열 생성 (상대 경로 포함)
    let fileInfoArray = [];
    filesWithPaths.forEach(({ file, relativePath }, index) => {
        fileInfoArray.push({
            originalName: file.name,
            relativePath: relativePath,
            size: file.size,
            index: index // FormData에서 파일을 찾기 위한 인덱스
        });
        totalSize += file.size;
    });

    // 현재 처리 중인 파일 정보 업데이트 함수
    function updateCurrentFileInfo() {
        if (currentFileIndex < filesWithPaths.length) {
            const currentFile = filesWithPaths[currentFileIndex].file;
            const fileSize = formatFileSize(currentFile.size);
            document.getElementById('currentFileUpload').textContent = `${currentFile.name} (${fileSize}) - 총 ${formatFileSize(totalSize)}`;
            document.getElementById('currentFileUpload').style.display = 'block';
        }
    }

    // 첫 번째 파일 정보 표시
    updateCurrentFileInfo();

    // 시작 시간 기록
    const startTime = new Date().getTime();

    // FormData에 모든 파일과 정보 추가
    const formData = new FormData();
    formData.append('path', targetUploadPath); // 기본 업로드 경로 (폴더 드롭 시 해당 폴더 경로)

    filesWithPaths.forEach(({ file }, index) => {
        formData.append(`file_${index}`, file, file.name); // 수정: 파일명을 명시적으로 지정
    });
    formData.append('fileInfo', JSON.stringify(fileInfoArray)); // 파일 정보 배열 추가 (상대 경로 포함)

    console.log('FormData 생성 완료. 업로드 시작...');
    console.log('업로드 대상 경로:', targetUploadPath);
    console.log('파일 정보:', fileInfoArray);


    // AJAX 요청으로 파일 전송
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/upload`);

    // 업로드 완료 플래그
    let uploadCompleted = false;
    let lastLoaded = 0; // 이전 파일까지 누적된 업로드 바이트
    let currentFileCumulativeSize = 0; // 현재 파일 시작 시점까지의 누적 크기

    xhr.upload.onprogress = (e) => {
        // 업로드가 이미 완료된 상태라면 진행률 업데이트 중지
        if (uploadCompleted) return;

        if (e.lengthComputable) {
            const loadedSoFar = e.loaded; // 현재까지 총 업로드된 바이트

            // 현재 처리 중인 파일 업데이트 로직 수정
            while (currentFileIndex < filesWithPaths.length &&
                   loadedSoFar >= currentFileCumulativeSize + filesWithPaths[currentFileIndex].file.size) {
                currentFileCumulativeSize += filesWithPaths[currentFileIndex].file.size;
                currentFileIndex++;
                updateCurrentFileInfo(); // 다음 파일 정보 표시
            }

            // 전체 업로드 진행률 계산
            const totalProgress = (loadedSoFar / e.total) * 100;

            // 업로드 속도 및 남은 시간 계산
            const currentTime = new Date().getTime();
            const elapsedTimeSeconds = (currentTime - startTime) / 1000 || 1; // 0으로 나누는 것 방지
            const uploadSpeed = loadedSoFar / elapsedTimeSeconds; // bytes per second
            const uploadSpeedFormatted = formatFileSize(uploadSpeed) + '/s';

            // 업로드가 거의 완료되면 진행률을 99%로 고정
            let progressValue = totalProgress;
            if (progressValue > 99 && loadedSoFar < e.total) progressValue = 99;
            if (loadedSoFar === e.total) progressValue = 100; // 완료 시 100%

            let remainingTime = (e.total - loadedSoFar) / uploadSpeed; // 남은 시간(초)
            if (remainingTime < 0 || !Number.isFinite(remainingTime)) remainingTime = 0;

            let timeDisplay;

            if (remainingTime < 60) {
                timeDisplay = `${Math.round(remainingTime)}초`;
            } else if (remainingTime < 3600) {
                timeDisplay = `${Math.floor(remainingTime / 60)}분 ${Math.round(remainingTime % 60)}초`;
            } else {
                timeDisplay = `${Math.floor(remainingTime / 3600)}시간 ${Math.floor((remainingTime % 3600) / 60)}분`;
            }

            // 진행률 표시 업데이트
            progressBar.style.width = `${progressValue}%`;

            // 업로드 상태 메시지 업데이트
            let progressStatusText = "";
             // currentFileIndex가 배열 범위를 벗어나지 않도록 확인
            const displayFileIndex = Math.min(currentFileIndex + 1, totalFiles);

            if (totalFiles === 1) {
                progressStatusText = `파일 업로드 중 - ${Math.round(progressValue)}% 완료 (${uploadSpeedFormatted}, 남은 시간: ${timeDisplay})`;
            } else {
                progressStatusText = `${displayFileIndex}/${totalFiles} 파일 업로드 중 - ${Math.round(progressValue)}% 완료 (${uploadSpeedFormatted}, 남은 시간: ${timeDisplay})`;
            }
            uploadStatus.textContent = progressStatusText;
            uploadStatus.style.display = 'block';

            // 현재 상태 업데이트
            statusInfo.textContent = `파일 업로드 중 (${Math.round(progressValue)}%, ${formatFileSize(loadedSoFar)}/${formatFileSize(e.total)})`;
        }
    };

    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
            // 업로드 완료 플래그 설정
            uploadCompleted = true;

            // 로딩 상태 초기화
            currentFileIndex = 0;
            currentFileCumulativeSize = 0;
            
            // 즉시 업로드 UI 상태 초기화 (타이머 없이 바로 설정)
            progressContainer.style.display = 'none';
            document.getElementById('currentFileUpload').style.display = 'none';

            if (xhr.status === 200 || xhr.status === 201) {
                // 업로드 성공 - 프로그레스바 100%로 설정
                progressBar.style.width = '100%';

                if (totalFiles === 1) {
                    uploadStatus.textContent = '파일 업로드 완료';
                } else {
                    uploadStatus.textContent = `${totalFiles}개 파일 업로드 완료`;
                }

                if (totalFiles === 1) {
                    statusInfo.textContent = '파일 업로드 완료';
                } else {
                    statusInfo.textContent = `${totalFiles}개 파일 업로드 완료`;
                }
                
                // 업로드된 경로로 파일 목록 새로고침
                loadFiles(targetUploadPath);
            } else {
                // 오류 처리
                let errorMsg = '업로드 실패';
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.error) {
                        errorMsg = `업로드 실패: ${response.message || response.error}`;
                    }
                } catch (e) {
                    errorMsg = `업로드 실패: ${xhr.status} ${xhr.statusText || '알 수 없는 오류'}`;
                }

                uploadStatus.textContent = errorMsg;
                statusInfo.textContent = errorMsg;
            }
            
            // 상태 표시 잠시 유지 후 숨김
            setTimeout(() => {
                uploadStatus.style.display = 'none';
            }, 2000);
        }
    };

    xhr.onerror = () => {
        // 업로드 완료 플래그 설정
        uploadCompleted = true;

        // 즉시 업로드 UI 상태 초기화
        progressContainer.style.display = 'none';
        document.getElementById('currentFileUpload').style.display = 'none';
        
        uploadStatus.textContent = `파일 업로드 실패: 네트워크 오류`;
        statusInfo.textContent = `파일 업로드 실패: 네트워크 오류`;

        // 잠시 후 상태 메시지만 숨김
        setTimeout(() => {
            uploadStatus.style.display = 'none';
        }, 2000);
    };

    xhr.send(formData);
}

// 파일/폴더 이동 함수
function moveItem(sourcePath, targetPath, overwrite = false) {
    return new Promise((resolve, reject) => {
        // 파일명 추출
        const fileName = sourcePath.split('/').pop();
        
        // 소스와 타겟이 같은 경로인지 확인
        if (sourcePath === `${targetPath}/${fileName}`) {
            console.log(`[${fileName}] 소스와 타겟이 동일합니다. 무시합니다.`);
            resolve(); // 에러가 아닌 정상 처리로 간주
            return;
        }
        
        console.log(`[${fileName}] 이동 시작: ${sourcePath} -> ${targetPath}, overwrite=${overwrite}`);
        
        // API 요청 - 이미 충돌 확인이 완료되었으므로 바로 API 호출
        return fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(sourcePath)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newName: fileName,
                targetPath: targetPath,
                overwrite: overwrite // 덮어쓰기 옵션
            })
        })
        .then(response => {
            if (response.ok) {
                console.log(`[${fileName}] 이동 성공`);
                resolve();
            } else {
                return response.text().then(text => {
                    console.error(`[${fileName}] 이동 실패:`, text);
                    reject(text || '이동 실패');
                });
            }
        })
        .catch(error => {
            console.error(`[${fileName}] 이동 오류:`, error);
            reject(error.message || '네트워크 오류');
        });
    });
}

// 뷰 모드 전환
function initViewModes() {
    gridViewBtn.addEventListener('click', () => {
        listView = false;
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        loadFiles(currentPath); 
    });
    
    listViewBtn.addEventListener('click', () => {
        listView = true;
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        loadFiles(currentPath);
    });
    
    // 기본값이 리스트뷰라면 초기에 활성화
    if (listView) {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
                    } else {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    }
}

// 폴더 생성 기능 초기화
function initFolderCreation() {
    // 새 폴더 버튼
    createFolderBtn.addEventListener('click', () => {
        // 현재 폴더에 존재하는 파일 목록 확인
        const fileItems = document.querySelectorAll('.file-item');
        const existingNames = Array.from(fileItems).map(item => item.getAttribute('data-name'));
        
        // 기본 폴더명 '새폴더'와 중복되지 않는 이름 찾기
        let defaultName = '새폴더';
        let counter = 1;
        
        while (existingNames.includes(defaultName)) {
            defaultName = `새폴더(${counter})`;
            counter++;
        }
        
        // 기본 폴더명 설정
        folderNameInput.value = defaultName;
        folderModal.style.display = 'flex';
        folderNameInput.focus();
        
        // 모든 텍스트를 선택하여 바로 수정할 수 있게 함
        folderNameInput.select();
    });
    
    // 폴더 생성 취소
    cancelFolderBtn.addEventListener('click', () => {
        folderModal.style.display = 'none';
    });
    
    // ESC 키로 폴더 생성 취소
    folderNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            folderModal.style.display = 'none';
            e.preventDefault(); // 이벤트 기본 동작 방지
        }
    });
    
    // Enter 키로 폴더 생성
    folderNameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            createFolderConfirmBtn.click();
        }
    });
    
    // 폴더 생성 확인
    createFolderConfirmBtn.addEventListener('click', () => {
        const folderName = folderNameInput.value.trim();
        
        if (!folderName) {
            alert('폴더 이름을 입력해주세요.');
            return;
        }
        
        const path = currentPath ? `${currentPath}/${folderName}` : folderName;
        // 경로에 한글이 포함된 경우를 위해 인코딩 처리
        const encodedPath = encodeURIComponent(path);
        
        showLoading();
        statusInfo.textContent = '폴더 생성 중...';
        
        fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('이미 존재하는 이름입니다.');
                }
                throw new Error('폴더 생성에 실패했습니다.');
            }
            folderModal.style.display = 'none';
            loadFiles(currentPath); // 파일 목록 새로고침
            statusInfo.textContent = '폴더 생성 완료';
        })
        .catch(error => {
            alert(error.message);
        hideLoading();
            statusInfo.textContent = '폴더 생성 실패';
        });
    });
}

// 이름 변경 기능 초기화
function initRenaming() {
    // 이름 변경 버튼
    renameBtn.addEventListener('click', showRenameDialog);
    
    // 이름 변경 취소
    cancelRenameBtn.addEventListener('click', () => {
        renameModal.style.display = 'none';
    });
    
    // ESC 키로 이름 변경 취소
    newNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            renameModal.style.display = 'none';
            e.preventDefault(); // 이벤트 기본 동작 방지
        }
    });
    
    // Enter 키로 이름 변경 완료
    newNameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            confirmRenameBtn.click();
        }
    });
    
    // 이름 변경 확인
    confirmRenameBtn.addEventListener('click', () => {
        const newName = newNameInput.value.trim();
        
        if (!newName) {
            alert('새 이름을 입력해주세요.');
            return;
        }

        const selectedItem = document.querySelector('.file-item.selected');
        const oldName = selectedItem.getAttribute('data-name');
        const oldPath = currentPath ? `${currentPath}/${oldName}` : oldName;
        // 경로에 한글이 포함된 경우를 위해 인코딩 처리
        const encodedPath = encodeURIComponent(oldPath);
        
        showLoading();
        statusInfo.textContent = '이름 변경 중...';
        
        fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newName: newName })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('이미 존재하는 이름입니다.');
                }
                throw new Error('이름 변경에 실패했습니다.');
            }
            renameModal.style.display = 'none';
            loadFiles(currentPath); // 파일 목록 새로고침
            statusInfo.textContent = '이름 변경 완료';
        })
        .catch(error => {
            alert(error.message);
            hideLoading();
            statusInfo.textContent = '이름 변경 실패';
        });
    });
}


// 파일 업로드 기능 초기화
function initFileUpload() {
    fileUploadInput.addEventListener('change', (e) => {
        const files = e.target.files;

        if (!files || files.length === 0) return;

        // 파일 크기 제한 확인
        const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB
        let hasLargeFile = false;
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > maxFileSize) {
                alert(`파일 크기가 너무 큽니다: ${files[i].name} (${formatFileSize(files[i].size)})
최대 파일 크기: 10GB`);
                hasLargeFile = true;
                break;
            }
        }

        if (hasLargeFile) {
            e.target.value = ''; // 파일 입력 초기화
            return;
        }

        // 업로드 소스 설정 및 카운터 초기화
        uploadSource = 'button';
        uploadButtonCounter = 0;

        // FileList를 { file: File, relativePath: string } 형태의 배열로 변환
        const filesWithPaths = Array.from(files).map(file => ({
            file: file,
            relativePath: file.name // 버튼 업로드는 상대 경로가 파일명 자체
        }));

        uploadFiles(filesWithPaths, currentPath); // 현재 경로에 업로드

        // 파일 입력 초기화
        e.target.value = '';
    });
}

// 잘라내기/붙여넣기 기능 초기화
function initClipboardOperations() {
    // 잘라내기 버튼
    cutBtn.addEventListener('click', cutSelectedItems);
    
    // 붙여넣기 버튼
    pasteBtn.addEventListener('click', pasteItems);
}

// 삭제 기능 초기화
function initDeletion() {
    deleteBtn.addEventListener('click', deleteSelectedItems);
}

// 검색 기능 초기화
function initSearch() {
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const fileName = item.getAttribute('data-name').toLowerCase();
            if (fileName.includes(query)) {
                item.style.display = '';
                } else {
                item.style.display = 'none';
            }
        });
    });
}

// 선택된 파일 다운로드
function downloadSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 단일 파일 다운로드
    if (selectedItems.size === 1) {
        const itemId = [...selectedItems][0];
        const element = document.querySelector(`.file-item[data-id="${itemId}"]`);
        const isFolder = element.getAttribute('data-is-folder') === 'true';
        
        // 단일 파일 경로 생성
        const filePath = currentPath ? `${currentPath}/${itemId}` : itemId;
        const encodedPath = encodeURIComponent(filePath);
        const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
        
        // 폴더인 경우에도 압축하여 다운로드
        if (isFolder) {
            compressAndDownload([itemId]);
            return;
        }
        
        // 일반 파일은 다운로드 - 새 창에서 열기
        window.open(fileUrl, '_blank');
        
        statusInfo.textContent = `${itemId} 다운로드 중...`;
        setTimeout(() => {
            statusInfo.textContent = `${itemId} 다운로드 완료`;
        }, 1000);
        
        return;
    }
    
    // 여러 항목 선택 시 압축하여 다운로드
    compressAndDownload([...selectedItems]);
}

// 여러 파일/폴더를 압축하여 다운로드
function compressAndDownload(itemList) {
    if (!itemList || itemList.length === 0) return;
    
    showLoading();
    statusInfo.textContent = '압축 패키지 준비 중...';
    
    // 기본 파일명 생성 (현재 폴더명 또는 기본명 + 날짜시간)
    const now = new Date();
    const dateTimeStr = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    
    // 현재 폴더명 또는 기본명으로 압축파일명 생성
    const currentFolderName = currentPath ? currentPath.split('/').pop() : 'files';
    const zipName = `${currentFolderName}_${dateTimeStr}.zip`;
    
    // API 요청 데이터
    const requestData = {
        files: itemList,
        targetPath: '',  // 임시 압축 위치는 루트에 생성
        zipName: zipName
    };
    
    // 압축 API 호출
    fetch(`${API_BASE_URL}/api/compress`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
        })
        .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '압축 중 오류가 발생했습니다.');
            });
        }
        return response.json();
    })
    .then(data => {
        // 압축 성공 후 다운로드 시작
        const zipPath = data.zipPath ? `${data.zipPath}/${data.zipFile}` : data.zipFile;
        const encodedZipPath = encodeURIComponent(zipPath);
        const zipUrl = `${API_BASE_URL}/api/files/${encodedZipPath}`;
        
        // 새 창에서 다운로드
        window.open(zipUrl, '_blank');
        
        // 상태 업데이트
        statusInfo.textContent = `${itemList.length}개 항목 압축 다운로드 중...`;
        hideLoading();
        
        // 임시 압축 파일 삭제 (다운로드 시작 후 10초 후)
        setTimeout(() => {
            fetch(`${API_BASE_URL}/api/files/${encodedZipPath}`, {
                method: 'DELETE'
            })
            .then(() => {
                console.log(`임시 압축 파일 삭제됨: ${zipPath}`);
            })
            .catch(err => {
                console.error('임시 압축 파일 삭제 오류:', err);
            });
            
            // 상태 메시지 업데이트
            statusInfo.textContent = `${itemList.length}개 항목 압축 다운로드 완료`;
        }, 10000); // 10초 후 삭제
    })
    .catch(error => {
        // 오류 처리
        console.error('압축 및 다운로드 오류:', error);
        alert(`압축 및 다운로드 중 오류가 발생했습니다: ${error.message}`);
        hideLoading();
        statusInfo.textContent = '다운로드 실패';
    });
}

// 항목 이동
function moveItems(itemIds) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) return;
    
    // 상위 폴더(..)는 제외
    const itemsToMove = itemIds.filter(id => id !== '..');
    
    if (itemsToMove.length === 0) {
        alert('이동할 항목이 없습니다. 상위 폴더는 이동할 수 없습니다.');
        return;
    }
    
    // 클립보드에 추가
    clipboardItems = [];
    itemsToMove.forEach(id => {
        const element = document.querySelector(`.file-item[data-id="${id}"]`);
        if (element) {
            clipboardItems.push({
                name: id,
                isFolder: element.getAttribute('data-is-folder') === 'true',
                originalPath: currentPath
            });
        }
    });
    
    clipboardOperation = 'cut';
    pasteBtn.disabled = false;
}

// 상위 폴더로 이동
function navigateToParentFolder() {
    if (!currentPath) return; // 이미 루트 폴더인 경우
    
    
    // 마지막 슬래시 위치 찾기
    const lastSlashIndex = currentPath.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
        // 슬래시가 없으면 루트 폴더로 이동
        currentPath = '';
            } else {
        // 슬래시가 있으면 상위 경로로 이동
        currentPath = currentPath.substring(0, lastSlashIndex);
    }
    
    // 폴더 이동 히스토리 상태 업데이트
    updateHistoryState(currentPath);
    
    // 파일 목록 새로고침
    loadFiles(currentPath);
    
    // 선택 초기화
    clearSelection();
}

// 브라우저 히스토리 상태 업데이트
function updateHistoryState(path) {
    const state = { path: path };
    const url = new URL(window.location.href);
    url.searchParams.set('path', path);
    
    // 현재 상태 교체
    window.history.pushState(state, '', url);
}

// 브라우저 뒤로가기/앞으로가기 이벤트 처리
function initHistoryNavigation() {
    // 페이지 로드 시 URL에서 경로 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const pathParam = urlParams.get('path');
    
    if (pathParam) {
        currentPath = pathParam;
    }
    
    // 초기 상태 설정
    const initialState = { path: currentPath };
    window.history.replaceState(initialState, '', window.location.href);
    
    // 팝스테이트 이벤트 핸들러
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path !== undefined) {
            currentPath = e.state.path;
            loadFiles(currentPath);
        }
    });
}

// 파일 다운로드 및 실행 함수
function downloadAndOpenFile(fileName) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const encodedPath = encodeURIComponent(filePath);
    const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
    
    // 파일 확장자 확인
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    // 실행 가능 확장자 목록
    const executableTypes = ['exe', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'app', 'vbs', 'jar'];
    
    // 브라우저에서 볼 수 있는 파일 확장자
    const viewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
                          'mp4', 'webm', 'ogg', 'mp3', 'wav', 
                          'pdf', 'txt', 'html', 'htm', 'css', 'js', 'json', 'xml'];
    
    // 실행 가능한 파일인 경우
    if (executableTypes.includes(fileExt)) {
        // 사용자에게 알림
        statusInfo.textContent = `${fileName} 다운로드 중...`;
        
        // 원래 방식으로 복구
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 명시적으로 download 속성 설정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            statusInfo.textContent = `${fileName} 다운로드 완료됨. 파일을 실행하세요.`;
        }, 1000);
    } 
    // 브라우저에서 볼 수 있는 파일인 경우
    else if (viewableTypes.includes(fileExt)) {
        // 직접 보기 모드로 URL 생성 (view=true 쿼리 파라미터 추가)
        const viewUrl = `${API_BASE_URL}/api/files/${encodedPath}?view=true`;
        // 새 창에서 열기
        window.open(viewUrl, '_blank');
        statusInfo.textContent = `${fileName} 파일 열기`;
    } 
    // 그 외 파일은 단순 다운로드
        else {
        // 원래 방식으로 복구
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 명시적으로 download 속성 설정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        statusInfo.textContent = `${fileName} 다운로드 중...`;
        
        setTimeout(() => {
            statusInfo.textContent = `${fileName} 다운로드 완료`;
        }, 1000);
    }
}

// 애플리케이션 초기화
function init() {
    // 혹시 이전 상태의 드래그 클래스가 있으면 초기화
    (function cleanupDragClasses() {
        console.log('초기화 시 드래그 클래스 정리');
        document.querySelectorAll('.dragging, .drag-over').forEach(el => {
            el.classList.remove('dragging');
            el.classList.remove('drag-over');
        });
    })();
    
    // 기본 기능 초기화
    initModals();
    initContextMenu();
    initDragSelect();
    initDragAndDrop();
    initShortcuts();
    initViewModes();
    initHistoryNavigation(); // 히스토리 네비게이션 초기화 추가
    setupGlobalDragCleanup(); // 드래그 상태 정리 기능 초기화
    
    // 파일 관리 기능 초기화
    initFolderCreation();
    initRenaming();
    initFileUpload();
    initClipboardOperations();
    initDeletion();
    initSearch();
    
    // 다운로드 버튼 이벤트 추가
    downloadBtn.addEventListener('click', downloadSelectedItems);
    
    // 새로고침 버튼 이벤트 추가
    document.getElementById('refreshStorageBtn').addEventListener('click', () => {
        loadDiskUsage();
    });
    
    // 초기 파일 목록 로드
    loadFiles(currentPath);
    
    // 드롭존 초기화
    initDropZone();
    
    // 스토리지 정보 로드
    loadDiskUsage();
    
    console.log('WebDAV 파일 탐색기 초기화됨');
}

// 페이지 로드 시 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', init);

// 선택한 파일 압축
function compressSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 선택된 파일/폴더 중 첫 번째 항목의 이름 가져오기
    const selectedItemsArray = Array.from(selectedItems);
    const firstItemName = selectedItemsArray[0];
    
    // 파일 크기 확인
    let hasLargeFile = false;
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    
    for (const item of selectedItemsArray) {
        const fileInfo = fileInfoMap.get(item);
        if (fileInfo && fileInfo.type === 'file' && fileInfo.size > MAX_FILE_SIZE) {
            hasLargeFile = true;
            break;
        }
    }
    
    if (hasLargeFile) {
        alert('500MB 이상의 파일이 포함되어 있어 압축할 수 없습니다.');
        return;
    }
    
    // 현재 날짜와 시간을 문자열로 변환
    const now = new Date();
    const dateTimeStr = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    
    // 기본 압축 파일 이름 설정 (첫 번째 선택 항목 + 날짜시간)
    const defaultZipName = `${firstItemName}_${dateTimeStr}`;
    
    // 압축 파일 이름 입력 받기
    const zipName = prompt('압축 파일 이름을 입력하세요:', defaultZipName);
    if (!zipName) return; // 취소한 경우
    
    showLoading();
    statusInfo.textContent = '압축 중...';
    
    // 압축할 파일 목록 생성
    const filesToCompress = selectedItemsArray;
    
    // API 요청 데이터
    const requestData = {
        files: filesToCompress,
        targetPath: currentPath,
        zipName: zipName
    };
    
    // 압축 API 호출
    fetch(`${API_BASE_URL}/api/compress`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '압축 중 오류가 발생했습니다.');
            });
        }
        return response.json();
    })
    .then(data => {
        // 성공 처리
        statusInfo.textContent = `${filesToCompress.length}개 항목이 ${data.zipFile}로 압축되었습니다.`;
        hideLoading();
        
        // 압축 후 파일 목록 새로고침
        loadFiles(currentPath);
        })
        .catch(error => {
        // 오류 처리
        console.error('압축 오류:', error);
        statusInfo.textContent = `압축 실패: ${error.message}`;
        alert(`압축 실패: ${error.message}`);
        hideLoading();
    });
}






// 드래그 선택 상태 관련 전역 변수 추가
window.dragSelectState = {
    isSelecting: false,
    dragStarted: false,
    startedOnFileItem: false,
    startedOnSelectedItem: false
};











// 폴더 탐색
function navigateToFolder(folderName) {
    let newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    currentPath = newPath;
    
    // 폴더 이동 히스토리 상태 업데이트
    updateHistoryState(currentPath);
    
    // 이전 더블클릭 이벤트 리스너 제거를 위해 기존 파일 항목 캐시
    const oldFileItems = document.querySelectorAll('.file-item, .file-item-grid');
    oldFileItems.forEach(item => {
        const clonedItem = item.cloneNode(true);
        item.parentNode.replaceChild(clonedItem, item);
    });
    
    // 파일 목록 로드 전에 마우스 포인터 상태 리셋
    document.querySelectorAll('.file-item, .file-item-grid').forEach(item => {
        if (item.classList) {
            item.classList.remove('hover');
        }
    });
    
    // 마우스 포인터 위치 재설정을 위한 강제 mousemove 이벤트 등록
    // 파일 목록이 로드된 후 실행하기 위해 타이머 설정
    setTimeout(() => {
        try {
            // 마우스 위치가 있을 경우에만 이벤트 발생
            if (typeof window.mouseX === 'number' && typeof window.mouseY === 'number') {
                // 마우스 이벤트 강제 발생 
                const mouseEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: window.mouseX,
                    clientY: window.mouseY
                });
                document.dispatchEvent(mouseEvent);
            }
        } catch (error) {
            console.error('마우스 이벤트 강제 발생 중 오류:', error);
        }
    }, 350);
    
    // 상위 폴더(..)를 제외한 모든 항목 선택
    document.querySelectorAll('.file-item:not([data-parent-dir="true"])').forEach(item => {
        item.classList.add('selected');
        selectedItems.add(item.getAttribute('data-name'));
    });
    
    updateButtonStates();
}

// 이름 변경 다이얼로그 표시
function showRenameDialog() {
    if (selectedItems.size !== 1) return;
    
    const selectedItem = document.querySelector('.file-item.selected');
    const currentName = selectedItem.getAttribute('data-name');
    const isFolder = selectedItem.getAttribute('data-is-folder') === 'true';
    
    // 폴더가 아닌 경우 확장자 분리
    let nameWithoutExt = currentName;
    let extension = '';
    
    if (!isFolder && currentName.includes('.')) {
        const lastDotIndex = currentName.lastIndexOf('.');
        nameWithoutExt = currentName.substring(0, lastDotIndex);
        extension = currentName.substring(lastDotIndex);
    }
    
    // 전체 이름을 input에 설정
    newNameInput.value = currentName;
    renameModal.style.display = 'flex';
    newNameInput.focus();
    
    // 파일인 경우 이름 부분만 선택 (확장자 제외)
    if (!isFolder && extension) {
        newNameInput.setSelectionRange(0, nameWithoutExt.length);
    } else {
        // 폴더인 경우 전체 선택
        newNameInput.select();
    }
}


// 선택 항목 잘라내기
function cutSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 이전에 잘라내기 표시된 항목 초기화
    document.querySelectorAll('.file-item.cut').forEach(item => {
        item.classList.remove('cut');
    });
    
    clipboardItems = [];
    
    // 상위 폴더(..)는 제외
    const itemsToProcess = new Set([...selectedItems].filter(itemId => itemId !== '..'));
    
    if (itemsToProcess.size === 0) {
        alert('잘라낼 항목이 없습니다. 상위 폴더는 잘라낼 수 없습니다.');
        return;
    }
    
    // 현재 선택된 항목을 클립보드에 복사
    itemsToProcess.forEach(itemId => {
        const element = document.querySelector(`.file-item[data-id="${itemId}"]`);
        clipboardItems.push({
            name: itemId,
            isFolder: element.getAttribute('data-is-folder') === 'true',
            originalPath: currentPath
        });
        
        // 잘라내기 표시
        element.classList.add('cut');
    });
    
    clipboardOperation = 'cut';
    pasteBtn.disabled = false;
    
    document.getElementById('ctxPaste').style.display = 'flex';
    
    statusInfo.textContent = `${clipboardItems.length}개 항목 잘라내기`;
    
    // 디버그 로그
    console.log('잘라내기 항목:', clipboardItems);
}

// 드래그 시작 처리
function handleDragStart(e, fileItem) {
    console.log('드래그 시작:', fileItem.getAttribute('data-name'));

    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }

    // 드래그 데이터 설정
    e.dataTransfer.effectAllowed = 'move';
    
    // 단일 항목 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 내부 파일 드래그임을 표시하는 데이터 추가
    e.dataTransfer.setData('application/webdav-internal', 'true');
    
    // 드래그 중 스타일 적용
    setTimeout(() => {
        document.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.add('dragging');
        });
    }, 0);
    
    isDragging = true;




        if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')) {
            // 기본 드롭 효과 설정 (드롭 후 판단)
            const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
            e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
            dropZone.classList.add('active');
        }
    }
    
function handleDropZoneDragLeave(e) {
        // relatedTarget이 null이거나 dropZone의 자식 요소가 아닌 경우에만 비활성화
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('active');
    }
}

function handleDropZoneDrop(e) {
    console.log('드롭존에 파일 드롭됨');
    preventDefaults(e);
    
    // 드래그 상태 초기화
    window.draggingInProgress = false;
    
    // 내부/외부 파일 판단
    const { isExternalDrop, isInternalDrop, draggedPaths, reason } = determineDropType(e);
    
    // 최종 판단: 외부 파일이 있으면 외부 드롭으로 처리
    if (isExternalDrop) {
        console.log('드롭존 드롭 - 외부 파일 드롭 처리');
        handleExternalFileDrop(e, currentPath);
    } 
    // 내부 파일이라도 경로가 비어있으면 오류 처리
    else if (isInternalDrop && draggedPaths.length > 0) {
        console.log('드롭존 드롭 - 내부 파일 이동 처리:', draggedPaths);
        // 현재 드롭존의 경로로 파일 이동
        handleInternalFileDrop(draggedPaths, { path: currentPath });
    }
    // 판단 불가능한 경우
    else {
        console.log('드롭존 드롭 - 처리할 수 없는 드롭 데이터');
        showToast('처리할 수 없는 드롭 데이터입니다.', 'error');
        
    }
    
    // 전체 영역 드롭존 이벤트 리스너 등록
    window.removeEventListener('dragenter', handleDropZoneDragEnter);
    window.removeEventListener('dragover', handleDropZoneDragOver);
    window.removeEventListener('dragleave', handleDropZoneDragLeave);
    dropZone.removeEventListener('drop', handleDropZoneDrop);
    
    console.log('드롭존 이벤트 리스너 등록 완료 (handleDrop 이벤트는 initDropZone에서 등록)');
    
    // 개발 모드에서 폴더 항목 CSS 선택자 유효성 확인
    console.log('폴더 항목 개수:', document.querySelectorAll('.file-item[data-is-folder="true"]').length);
}

// 내부 드래그인지 확인하는 함수 (파일 경로 기반 + 기본값은 내부)
function isInternalDrag(e) {
    // 공통 함수를 재사용하여 드래그 타입 판단
    if (!e || !e.dataTransfer) return true; // 기본값은 내부
    
    // 결정적인 외부 파일 증거: File 객체가 존재하면 무조건 외부 파일로 판단
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        return false; // 외부 파일
    }
    
    // 내부 드래그 마커가 있으면 확실한 내부 파일
    if (e.dataTransfer.types.includes('application/x-internal-drag')) {
        return true;
    }

    // 내부 드래그 진행 상태 확인 (전역 변수)
    if (window.draggingInProgress) {
        return true;
    }
    
    // 기본값은 내부로 판단 (확실한 외부 증거가 없으면)
    return true;
}

// 내부 파일 드롭 처리 함수 (실제 이동 로직 구현)
async function handleInternalFileDrop(draggedItemPaths, targetFolderItem) {
    console.log('[Internal Drop] 내부 파일 이동 처리 시작:', draggedItemPaths);

    // 타겟 폴더 경로 결정
    let targetPath = currentPath;
    let targetName = '현재 폴더';
    
    if (targetFolderItem) {
        // 타겟 폴더가 주어진 경우 (파일 항목에 드롭된 경우)
        const folderName = targetFolderItem.getAttribute('data-name');
        targetPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        targetName = folderName;
    }
    
    console.log(`[Internal Drop] 타겟 경로: ${targetPath}, 타겟 이름: ${targetName}`);
    
    // 드래그된 데이터가 유효한지 확인
    if (!Array.isArray(draggedItemPaths) || draggedItemPaths.length === 0) {
        console.error('[Internal Drop] 유효하지 않은 파일 경로 정보');
        showToast('이동할 항목 정보가 유효하지 않습니다.', 'error');
             return;
        }

    // 경로 처리 및 유효성 검사
    const validItemPaths = draggedItemPaths.filter(path => {
        // 경로가 유효한 문자열인지 확인
        if (typeof path !== 'string' || !path.trim()) {
            console.warn('[Internal Drop] 유효하지 않은 경로 제외:', path);
            return false;
        }
        return true;
    });
    
    if (validItemPaths.length === 0) {
        console.error('[Internal Drop] 유효한 경로가 없음');
        showToast('이동할 유효한 항목이 없습니다.', 'error');
        return;
    }
    
    // 경로 처리 및 이름 추출
    const itemsInfo = validItemPaths.map(path => {
        // 경로에서 파일/폴더 이름 추출
        const itemName = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path;
        // 경로에서 부모 경로 추출 (루트는 빈 문자열)
        const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
        
        // fileInfoMap에서 정보 가져오기 (이름으로 조회)
        const itemInfo = fileInfoMap.get(itemName) || null;
        
        return {
            fullPath: path,
            name: itemName,
            parentPath,
            isFolder: itemInfo ? itemInfo.isFolder : false,
            info: itemInfo
        };
    });
    
    console.log('[Internal Drop] 항목 정보:', itemsInfo);
    
    // --- 유효성 검사 시작 ---
    
    // 1. 타겟 폴더가 이동하려는 항목 중 하나인 경우 방지
    if (targetFolderItem) {
        const targetInDraggedItems = itemsInfo.some(item => item.fullPath === targetPath);
        if (targetInDraggedItems) {
            console.warn(`[Internal Drop] 선택된 항목 중 하나인 '${targetName}'(으)로는 이동할 수 없습니다.`);
             showToast(`선택된 항목 중 하나인 '${targetName}'(으)로는 이동할 수 없습니다.`, 'warning');
             return;
        }
    }
    
    // 2. 폴더를 자신의 하위 폴더로 이동하려는 경우 방지
    for (const item of itemsInfo) {
        if (item.isFolder && targetPath.startsWith(item.fullPath + '/')) {
            console.warn(`[Internal Drop] 폴더 '${item.name}'를 자신의 하위 폴더 '${targetName}'(으)로 이동할 수 없습니다.`);
            showToast(`폴더 '${item.name}'를 자신의 하위 폴더 '${targetName}'(으)로 이동할 수 없습니다.`, 'warning');
            return;
        }
    }
    
    // 3. 이미 대상 폴더에 있는 항목 필터링
    const itemsToMove = itemsInfo.filter(item => item.parentPath !== targetPath);
    
    if (itemsToMove.length === 0) {
        console.log('[Internal Drop] 이동할 필요가 있는 항목이 없습니다.');
        showToast('모든 항목이 이미 대상 폴더에 있습니다.', 'info');
        clearSelection();
        return;
    }

    // --- 유효성 검사 끝 ---
    
    // 이동 시작
    console.log(`[Internal Drop] ${itemsToMove.length}개 항목 이동 준비 완료:`, 
                itemsToMove.map(item => item.name));
    
    showLoading();
    try {
        // 실제 항목 이동 (이동할 항목의 전체 경로 배열 전달)
        await moveToFolder(itemsToMove.map(item => item.fullPath), targetPath);
        
        console.log('[Internal Drop] 이동 작업 성공');
        showToast(`${itemsToMove.length}개 항목을 '${targetName}'(으)로 이동했습니다.`, 'success');
        
        // 파일 목록 새로고침 (moveToFolder에서 처리하므로 제거)
        // loadFiles(currentPath);
    } catch (error) {
        console.error('[Internal Drop] 이동 중 오류 발생:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`항목 이동 중 오류: ${errorMessage}`, 'error');
        
        // 오류 발생 시에도 파일 목록 새로고침 (moveToFolder에서 처리하므로 제거)
        // loadFiles(currentPath);
    } finally {
        hideLoading();
        clearSelection(); // 이동 후 선택 해제
    }
}

// 외부 파일 드롭 처리 함수
async function handleExternalFileDrop(e, targetFolderItem = null) { // async 키워드 추가
    if (isHandlingDrop) {
        console.log('이미 드롭 처리 중입니다. 중복 호출 방지.');
        return; // 중복 실행 방지
    }
    isHandlingDrop = true; // 처리 시작 플래그 설정

    try {
        // 진행 중인 업로드가 있는지 확인
        if (progressContainer.style.display === 'block') {
            statusInfo.textContent = '이미 업로드가 진행 중입니다. 완료 후 다시 시도하세요.';
            console.log('이미 진행 중인 업로드가 있어 새 업로드를 취소합니다.');
            return;
        }

        // DataTransferItemList 사용
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) {
            console.log('드롭된 항목이 없습니다.');
            return;
        }

        // 업로드 소스 설정 및 카운터 초기화
        uploadSource = 'dragdrop';
        dragDropCounter = 0;

        let targetPath = currentPath; // 기본 업로드 경로는 현재 경로

        // 타겟 폴더가 지정된 경우 경로 업데이트
        if (targetFolderItem) {
            const targetFolder = targetFolderItem.getAttribute('data-name');
            targetPath = currentPath ? `${currentPath}/${targetFolder}` : targetFolder;
            console.log('외부 파일 드래그 감지: 대상 폴더:', targetFolder);
                    } else {
            console.log('외부 파일 드래그 감지: 현재 경로에 업로드');
        }

        showLoading();
        statusInfo.textContent = '파일 목록을 읽는 중...';

        const filesWithPaths = [];
        const promises = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    promises.push(traverseFileTree(entry, '', filesWithPaths));
                } else {
                    // webkitGetAsEntry가 지원되지 않는 경우 직접 파일 가져오기
                    const file = item.getAsFile();
                    if (file) {
                        filesWithPaths.push({ file, relativePath: file.name });
                    }
                }
            }
        }

        await Promise.all(promises);

        hideLoading();

        if (filesWithPaths.length === 0) {
            statusInfo.textContent = '업로드할 파일을 찾을 수 없습니다.';
            console.log('업로드할 파일이 없습니다.');
            return;
        }

        console.log(`총 ${filesWithPaths.length}개의 파일 수집 완료.`);
        // uploadFiles 함수 호출 시 targetPath 전달
        uploadFiles(filesWithPaths, targetPath); // 수정: targetPath 전달

    } catch (error) {
        hideLoading();
        statusInfo.textContent = '파일 목록 읽기 오류.';
        console.error('파일 트리 탐색 오류:', error);
        alert('파일 목록을 읽는 중 오류가 발생했습니다.');
    } finally {
        isHandlingDrop = false; // 처리 완료 또는 오류 발생 시 플래그 해제
    }
}

// 파일 트리 탐색 함수 (폴더 포함)
function traverseFileTree(entry, path, filesWithPaths) {
    return new Promise((resolve, reject) => {
        // 경로 이름 길이 제한 확인 및 처리
        const maxPathComponentLength = 220; // 경로 구성요소의 최대 길이 설정
        const maxFullPathLength = 3800; // 전체 경로 최대 길이 (바이트)
        const originalEntryName = entry.name;
        let entryName = originalEntryName;
        
        // 폴더나 파일 이름이 너무 길면 처리
        if (new TextEncoder().encode(entryName).length > maxPathComponentLength) {
            // 폴더인 경우 확장자가 없으므로 단순히 잘라서 처리
            if (entry.isDirectory) {
                // 바이트 단위로 자르기
                let shortName = '';
                const encodedName = new TextEncoder().encode(entryName);
                const maxBytes = maxPathComponentLength - 3; // "..." 공간 확보
                
                // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                let byteCount = 0;
                for (let i = 0; i < entryName.length; i++) {
                    const charBytes = new TextEncoder().encode(entryName[i]).length;
                    if (byteCount + charBytes <= maxBytes) {
                        shortName += entryName[i];
                        byteCount += charBytes;
                    } else {
            break;
                    }
                }
                
                entryName = shortName + '...';
                console.log(`폴더명이 너무 깁니다. 원본: ${originalEntryName}, 수정됨: ${entryName}`);
            }
            // 파일인 경우는 아래에서 별도 처리
        }

        // 현재 경로 계산
        const currentPath = path ? `${path}/${entryName}` : entryName;
        
        // 전체 경로가 너무 길어질 가능성이 있는지 확인 (바이트 단위로 정확히 계산)
        const pathBytes = new TextEncoder().encode(currentPath).length;
        if (pathBytes > maxFullPathLength / 2) {
            console.warn(`경로가 길어질 가능성이 있습니다: ${currentPath} (${pathBytes} bytes)`);
        }

        if (entry.isFile) {
            entry.file(file => {
                // 숨김 파일 (.으로 시작)은 제외
                if (!file.name.startsWith('.')) {
                    // 파일 이름 길이 체크 및 처리
                    const maxFileNameLength = 220; // 최대 파일명 바이트 길이 설정
                    let fileName = file.name;
                    let relativePath = currentPath;
                    
                    // 파일명 바이트 길이 계산
                    const fileNameBytes = new TextEncoder().encode(fileName).length;
                    
                    // 파일명이 너무 길면 잘라내기
                    if (fileNameBytes > maxFileNameLength) {
                        const extension = fileName.lastIndexOf('.') > 0 ? fileName.substring(fileName.lastIndexOf('.')) : '';
                        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.') > 0 ? fileName.lastIndexOf('.') : fileName.length);
                        
                        // 바이트 기준으로 이름 자르기
                        let shortName = '';
                        const maxBytes = maxFileNameLength - new TextEncoder().encode(extension).length - 3; // "..." 공간 확보
                        
                        // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                        let byteCount = 0;
                        for (let i = 0; i < fileNameWithoutExt.length; i++) {
                            const charBytes = new TextEncoder().encode(fileNameWithoutExt[i]).length;
                            if (byteCount + charBytes <= maxBytes) {
                                shortName += fileNameWithoutExt[i];
                                byteCount += charBytes;
                            } else {
            break;
                            }
                        }
                        
                        const newFileName = shortName + '...' + extension;
                        
                        // 상대 경로도 수정
                        if (path) {
                            relativePath = `${path}/${newFileName}`;
                        } else {
                            relativePath = newFileName;
                        }
                        
                        console.log(`파일명이 너무 깁니다. 원본: ${fileName}, 수정됨: ${newFileName}`);
                        
                        // 파일 객체를 새로운 이름으로 복제 (File 객체는 직접 수정할 수 없음)
                        const renamedFile = new File([file], newFileName, { type: file.type });
                        filesWithPaths.push({ file: renamedFile, relativePath: relativePath });
                    } else {
                        // 전체 경로 바이트 길이 확인 (UTF-8)
                        const fullPathBytes = new TextEncoder().encode(relativePath).length;
                        
                        if (fullPathBytes > maxFullPathLength) {
                            // 경로가 너무 길면 비상 처리 (파일만 남기고 경로 단축)
                            console.warn(`전체 경로가 너무 깁니다(${fullPathBytes} bytes): ${relativePath}`);
                            
                            // 파일명만 보존하고 경로는 압축
                            const shortenedPath = `긴경로/${fileName}`;
                            console.log(`경로 단축됨: ${relativePath} → ${shortenedPath}`);
                            
                            // 중요: 원본 파일 이름은 유지하되 경로만 변경
                            filesWithPaths.push({ file: file, relativePath: shortenedPath });
                            statusInfo.textContent = `일부 파일의 경로가 너무 길어 단축되었습니다.`;
                        } else {
                            // 정상 경로
                            filesWithPaths.push({ file: file, relativePath: relativePath });
                            console.log(`파일 추가: ${relativePath}`);
                        }
                    }
                } else {
                    console.log(`숨김 파일 제외: ${currentPath}`);
                }
                resolve();
            }, err => {
                console.error(`파일 읽기 오류 (${currentPath}):`, err);
                reject(err); // 오류 발생 시 reject 호출
            });
        } else if (entry.isDirectory) {
            // 숨김 폴더 (.으로 시작)는 제외
            if (entry.name.startsWith('.')) {
                console.log(`숨김 폴더 제외: ${currentPath}`);
                resolve(); // 숨김 폴더는 처리하지 않고 resolve
                return;
            }
    
            // 전체 경로 바이트 길이 확인 (UTF-8)
            const fullPathBytes = new TextEncoder().encode(currentPath).length;
            
            if (fullPathBytes > maxFullPathLength) {
                console.warn(`폴더 경로가 너무 깁니다(${fullPathBytes} bytes). 접근 가능한 경로로 단축: ${currentPath}`);
                statusInfo.textContent = `일부 폴더의 경로가 너무 길어 단축되었습니다.`;
                
                // 폴더명 단축 버전 생성 (폴더명 앞부분 + "..." 형태로)
                // UTF-8 바이트 길이를 고려하여 자름
                let shortName = '';
                const maxBytes = 20; // 짧게 유지
                
                // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                let byteCount = 0;
                for (let i = 0; i < entry.name.length; i++) {
                    const charBytes = new TextEncoder().encode(entry.name[i]).length;
                    if (byteCount + charBytes <= maxBytes) {
                        shortName += entry.name[i];
                        byteCount += charBytes;
                    } else {
            break;
                    }
                }
                
                const shortenedDirName = shortName + "...";
                const shortenedPath = path ? `${path}/${shortenedDirName}` : shortenedDirName;
                
                console.log(`폴더 경로 단축됨: ${currentPath} → ${shortenedPath}`);
                
                // 단축된 경로로 계속 진행
                const dirReader = entry.createReader();
                let allEntries = [];

                const readEntries = () => {
                    dirReader.readEntries(entries => {
                        if (entries.length === 0) {
                            // 모든 항목을 읽었으면 재귀 호출 실행
                            Promise.all(allEntries.map(subEntry => {
                                return traverseFileTree(subEntry, shortenedPath, filesWithPaths);
                            }))
                                .then(resolve)
                                .catch(reject);
            } else {
                            // 읽은 항목을 allEntries에 추가하고 계속 읽기
                            allEntries = allEntries.concat(entries);
                            readEntries();
                        }
                    }, err => {
                        console.error(`폴더 읽기 오류 (${shortenedPath}):`, err);
                        reject(err);
                    });
                };
                readEntries();
             return;
        }
        
        console.log(`폴더 탐색: ${currentPath}`);
        const dirReader = entry.createReader();
        let allEntries = [];

        const readEntries = () => {
            dirReader.readEntries(entries => {
                if (entries.length === 0) {
                    // 모든 항목을 읽었으면 재귀 호출 실행
                    Promise.all(allEntries.map(subEntry => {
                        // 원본 entry 이름이 변경된 경우 하위 항목의 상대 경로 계산에도 적용
                        const subPath = originalEntryName !== entryName ? 
                            (currentPath) : 
                            (path ? `${path}/${entry.name}` : entry.name);
                        return traverseFileTree(subEntry, subPath, filesWithPaths);
                    }))
                        .then(resolve)
                        .catch(reject); // 하위 탐색 중 오류 발생 시 reject
                } else {
                    // 읽은 항목을 allEntries에 추가하고 계속 읽기
                    allEntries = allEntries.concat(entries);
                    readEntries(); // 재귀적으로 호출하여 모든 항목 읽기
                }
            }, err => {
                console.error(`폴더 읽기 오류 (${currentPath}):`, err);
                reject(err); // 폴더 읽기 오류 시 reject
            });
        };
        readEntries();
    } else {
        console.warn(`알 수 없는 항목 타입: ${entry.name}`);
        resolve(); // 알 수 없는 타입은 무시하고 resolve
    }
});
}


// 특정 폴더에 파일 업로드 (files 인자 변경: File[] -> { file: File, relativePath: string }[])
// targetUploadPath 인자 추가
function uploadFiles(filesWithPaths, targetUploadPath = currentPath) {
    if (!filesWithPaths || filesWithPaths.length === 0) return;

    // 호출 카운터 증가 - 오직 새로운 업로드 세션에서만 증가
    // uploadSource는 handleExternalFileDrop 또는 파일 입력 변경 리스너에서 설정됨
    if (uploadSource === 'button') {
        uploadButtonCounter++;
        console.log(`버튼 업로드 호출 횟수: ${uploadButtonCounter}, 파일 수: ${filesWithPaths.length}`);
        statusInfo.textContent = `버튼 업로드 호출 횟수: ${uploadButtonCounter}, 파일 수: ${filesWithPaths.length}`;
    } else if (uploadSource === 'dragdrop') {
        dragDropCounter++;
        console.log(`드래그앤드롭 업로드 호출 횟수: ${dragDropCounter}, 파일 수: ${filesWithPaths.length}`);
        statusInfo.textContent = `드래그앤드롭 업로드 호출 횟수: ${dragDropCounter}, 파일 수: ${filesWithPaths.length}`;
    }

    // 진행 중 업로드가 있으면 종료 처리
    if (progressContainer.style.display === 'block') {
        console.log('이미 진행 중인 업로드가 있어 새 업로드를 취소합니다.');
            return;
        }

    // 업로드 UI 표시
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    // 전체 파일 크기와 현재까지 업로드된 크기를 추적
    const totalFiles = filesWithPaths.length;
    let totalSize = 0;
    let currentFileIndex = 0; // 현재 처리 중인 파일 인덱스

    // 모든 파일 정보 배열 생성 (상대 경로 포함)
    let fileInfoArray = [];
    filesWithPaths.forEach(({ file, relativePath }, index) => {
        fileInfoArray.push({
            originalName: file.name,
            relativePath: relativePath,
            size: file.size,
            index: index // FormData에서 파일을 찾기 위한 인덱스
        });
        totalSize += file.size;
    });

    // 현재 처리 중인 파일 정보 업데이트 함수
    function updateCurrentFileInfo() {
        if (currentFileIndex < filesWithPaths.length) {
            const currentFile = filesWithPaths[currentFileIndex].file;
            const fileSize = formatFileSize(currentFile.size);
            document.getElementById('currentFileUpload').textContent = `${currentFile.name} (${fileSize}) - 총 ${formatFileSize(totalSize)}`;
            document.getElementById('currentFileUpload').style.display = 'block';
        }
    }

    // 첫 번째 파일 정보 표시
    updateCurrentFileInfo();

    // 시작 시간 기록
    const startTime = new Date().getTime();

    // FormData에 모든 파일과 정보 추가
    const formData = new FormData();
    formData.append('path', targetUploadPath); // 기본 업로드 경로 (폴더 드롭 시 해당 폴더 경로)

    filesWithPaths.forEach(({ file }, index) => {
        formData.append(`file_${index}`, file, file.name); // 수정: 파일명을 명시적으로 지정
    });
    formData.append('fileInfo', JSON.stringify(fileInfoArray)); // 파일 정보 배열 추가 (상대 경로 포함)

    console.log('FormData 생성 완료. 업로드 시작...');
    console.log('업로드 대상 경로:', targetUploadPath);
    console.log('파일 정보:', fileInfoArray);


    // AJAX 요청으로 파일 전송
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/upload`);

    // 업로드 완료 플래그
    let uploadCompleted = false;
    let lastLoaded = 0; // 이전 파일까지 누적된 업로드 바이트
    let currentFileCumulativeSize = 0; // 현재 파일 시작 시점까지의 누적 크기

    xhr.upload.onprogress = (e) => {
        // 업로드가 이미 완료된 상태라면 진행률 업데이트 중지
        if (uploadCompleted) return;

        if (e.lengthComputable) {
            const loadedSoFar = e.loaded; // 현재까지 총 업로드된 바이트

            // 현재 처리 중인 파일 업데이트 로직 수정
            while (currentFileIndex < filesWithPaths.length &&
                   loadedSoFar >= currentFileCumulativeSize + filesWithPaths[currentFileIndex].file.size) {
                currentFileCumulativeSize += filesWithPaths[currentFileIndex].file.size;
                currentFileIndex++;
                updateCurrentFileInfo(); // 다음 파일 정보 표시
            }

            // 전체 업로드 진행률 계산
            const totalProgress = (loadedSoFar / e.total) * 100;

            // 업로드 속도 및 남은 시간 계산
            const currentTime = new Date().getTime();
            const elapsedTimeSeconds = (currentTime - startTime) / 1000 || 1; // 0으로 나누는 것 방지
            const uploadSpeed = loadedSoFar / elapsedTimeSeconds; // bytes per second
            const uploadSpeedFormatted = formatFileSize(uploadSpeed) + '/s';

            // 업로드가 거의 완료되면 진행률을 99%로 고정
            let progressValue = totalProgress;
            if (progressValue > 99 && loadedSoFar < e.total) progressValue = 99;
            if (loadedSoFar === e.total) progressValue = 100; // 완료 시 100%

            let remainingTime = (e.total - loadedSoFar) / uploadSpeed; // 남은 시간(초)
            if (remainingTime < 0 || !Number.isFinite(remainingTime)) remainingTime = 0;

            let timeDisplay;

            if (remainingTime < 60) {
                timeDisplay = `${Math.round(remainingTime)}초`;
            } else if (remainingTime < 3600) {
                timeDisplay = `${Math.floor(remainingTime / 60)}분 ${Math.round(remainingTime % 60)}초`;
            } else {
                timeDisplay = `${Math.floor(remainingTime / 3600)}시간 ${Math.floor((remainingTime % 3600) / 60)}분`;
            }

            // 진행률 표시 업데이트
            progressBar.style.width = `${progressValue}%`;

            // 업로드 상태 메시지 업데이트
            let progressStatusText = "";
             // currentFileIndex가 배열 범위를 벗어나지 않도록 확인
            const displayFileIndex = Math.min(currentFileIndex + 1, totalFiles);

            if (totalFiles === 1) {
                progressStatusText = `파일 업로드 중 - ${Math.round(progressValue)}% 완료 (${uploadSpeedFormatted}, 남은 시간: ${timeDisplay})`;
            } else {
                progressStatusText = `${displayFileIndex}/${totalFiles} 파일 업로드 중 - ${Math.round(progressValue)}% 완료 (${uploadSpeedFormatted}, 남은 시간: ${timeDisplay})`;
            }
            uploadStatus.textContent = progressStatusText;
            uploadStatus.style.display = 'block';

            // 현재 상태 업데이트
            statusInfo.textContent = `파일 업로드 중 (${Math.round(progressValue)}%, ${formatFileSize(loadedSoFar)}/${formatFileSize(e.total)})`;
        }
    };

    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
            // 업로드 완료 플래그 설정
            uploadCompleted = true;

            // 로딩 상태 초기화
            currentFileIndex = 0;
            currentFileCumulativeSize = 0;
            
            // 즉시 업로드 UI 상태 초기화 (타이머 없이 바로 설정)
            progressContainer.style.display = 'none';
            document.getElementById('currentFileUpload').style.display = 'none';

            if (xhr.status === 200 || xhr.status === 201) {
                // 업로드 성공 - 프로그레스바 100%로 설정
                progressBar.style.width = '100%';

                if (totalFiles === 1) {
                    uploadStatus.textContent = '파일 업로드 완료';
                } else {
                    uploadStatus.textContent = `${totalFiles}개 파일 업로드 완료`;
                }

                if (totalFiles === 1) {
                    statusInfo.textContent = '파일 업로드 완료';
                } else {
                    statusInfo.textContent = `${totalFiles}개 파일 업로드 완료`;
                }
                
                // 업로드된 경로로 파일 목록 새로고침
                loadFiles(targetUploadPath);
            } else {
                // 오류 처리
                let errorMsg = '업로드 실패';
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.error) {
                        errorMsg = `업로드 실패: ${response.message || response.error}`;
                    }
                } catch (e) {
                    errorMsg = `업로드 실패: ${xhr.status} ${xhr.statusText || '알 수 없는 오류'}`;
                }

                uploadStatus.textContent = errorMsg;
                statusInfo.textContent = errorMsg;
            }
            
            // 상태 표시 잠시 유지 후 숨김
            setTimeout(() => {
                uploadStatus.style.display = 'none';
            }, 2000);
        }
    };

    xhr.onerror = () => {
        // 업로드 완료 플래그 설정
        uploadCompleted = true;

        // 즉시 업로드 UI 상태 초기화
        progressContainer.style.display = 'none';
        document.getElementById('currentFileUpload').style.display = 'none';
        
        uploadStatus.textContent = `파일 업로드 실패: 네트워크 오류`;
        statusInfo.textContent = `파일 업로드 실패: 네트워크 오류`;

        // 잠시 후 상태 메시지만 숨김
        setTimeout(() => {
            uploadStatus.style.display = 'none';
        }, 2000);
    };

    xhr.send(formData);
}

// 파일/폴더 이동 함수
function moveItem(sourcePath, targetPath, overwrite = false) {
    return new Promise((resolve, reject) => {
        // 파일명 추출
        const fileName = sourcePath.split('/').pop();
        
        // 소스와 타겟이 같은 경로인지 확인
        if (sourcePath === `${targetPath}/${fileName}`) {
            console.log(`[${fileName}] 소스와 타겟이 동일합니다. 무시합니다.`);
            resolve(); // 에러가 아닌 정상 처리로 간주
            return;
        }
        
        console.log(`[${fileName}] 이동 시작: ${sourcePath} -> ${targetPath}, overwrite=${overwrite}`);
        
        // API 요청 - 이미 충돌 확인이 완료되었으므로 바로 API 호출
        return fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(sourcePath)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newName: fileName,
                targetPath: targetPath,
                overwrite: overwrite // 덮어쓰기 옵션
            })
        })
        .then(response => {
            if (response.ok) {
                console.log(`[${fileName}] 이동 성공`);
                resolve();
            } else {
                return response.text().then(text => {
                    console.error(`[${fileName}] 이동 실패:`, text);
                    reject(text || '이동 실패');
                });
            }
        })
        .catch(error => {
            console.error(`[${fileName}] 이동 오류:`, error);
            reject(error.message || '네트워크 오류');
        });
    });
}

// 뷰 모드 전환
function initViewModes() {
    gridViewBtn.addEventListener('click', () => {
        listView = false;
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        loadFiles(currentPath); 
    });
    
    listViewBtn.addEventListener('click', () => {
        listView = true;
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        loadFiles(currentPath);
    });
    
    // 기본값이 리스트뷰라면 초기에 활성화
    if (listView) {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
                    } else {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    }
}

// 폴더 생성 기능 초기화
function initFolderCreation() {
    // 새 폴더 버튼
    createFolderBtn.addEventListener('click', () => {
        // 현재 폴더에 존재하는 파일 목록 확인
        const fileItems = document.querySelectorAll('.file-item');
        const existingNames = Array.from(fileItems).map(item => item.getAttribute('data-name'));
        
        // 기본 폴더명 '새폴더'와 중복되지 않는 이름 찾기
        let defaultName = '새폴더';
        let counter = 1;
        
        while (existingNames.includes(defaultName)) {
            defaultName = `새폴더(${counter})`;
            counter++;
        }
        
        // 기본 폴더명 설정
        folderNameInput.value = defaultName;
        folderModal.style.display = 'flex';
        folderNameInput.focus();
        
        // 모든 텍스트를 선택하여 바로 수정할 수 있게 함
        folderNameInput.select();
    });
    
    // 폴더 생성 취소
    cancelFolderBtn.addEventListener('click', () => {
        folderModal.style.display = 'none';
    });
    
    // ESC 키로 폴더 생성 취소
    folderNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            folderModal.style.display = 'none';
            e.preventDefault(); // 이벤트 기본 동작 방지
        }
    });
    
    // Enter 키로 폴더 생성
    folderNameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            createFolderConfirmBtn.click();
        }
    });
    
    // 폴더 생성 확인
    createFolderConfirmBtn.addEventListener('click', () => {
        const folderName = folderNameInput.value.trim();
        
        if (!folderName) {
            alert('폴더 이름을 입력해주세요.');
            return;
        }
        
        const path = currentPath ? `${currentPath}/${folderName}` : folderName;
        // 경로에 한글이 포함된 경우를 위해 인코딩 처리
        const encodedPath = encodeURI(path);
        
    showLoading();
        statusInfo.textContent = '폴더 생성 중...';
        
        fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('이미 존재하는 이름입니다.');
                }
                throw new Error('폴더 생성에 실패했습니다.');
            }
            folderModal.style.display = 'none';
            loadFiles(currentPath); // 파일 목록 새로고침
            statusInfo.textContent = '폴더 생성 완료';
        })
        .finally(() => {
            hideLoading();
        })      
        .catch(error => {
            showToast(error.message || '폴더 생성 중 오류 발생', 'error');
        hideLoading();
            statusInfo.textContent = '';
        });
    });
}

// 이름 변경 기능 초기화
function initRenaming() {
    // 이름 변경 버튼
    renameBtn.addEventListener('click', showRenameDialog);
    
    // 이름 변경 취소
    cancelRenameBtn.addEventListener('click', () => {
        renameModal.style.display = 'none';
    });
    
    // ESC 키로 이름 변경 취소
    newNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            renameModal.style.display = 'none';
            e.preventDefault(); // 이벤트 기본 동작 방지
        }
    });
    
    // Enter 키로 이름 변경 완료
    newNameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            confirmRenameBtn.click();
        }
    });
    
    // 이름 변경 확인
    confirmRenameBtn.addEventListener('click', () => {
        const newName = newNameInput.value.trim();
        
        if (!newName) {
            alert('새 이름을 입력해주세요.');
            return;
        }

        const selectedItem = document.querySelector('.file-item.selected');
        const oldName = selectedItem.getAttribute('data-name');
        const oldPath = currentPath ? `${currentPath}/${oldName}` : oldName;
        // 경로에 한글이 포함된 경우를 위해 인코딩 처리
        const encodedPath = encodeURIComponent(oldPath);
        
        showLoading();
        statusInfo.textContent = '이름 변경 중...';
        
        fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newName: newName })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('이미 존재하는 이름입니다.');
                }
                throw new Error('이름 변경에 실패했습니다.');
            }
            renameModal.style.display = 'none';
            loadFiles(currentPath); // 파일 목록 새로고침
            statusInfo.textContent = '이름 변경 완료';
        })
        .catch(error => {
            alert(error.message);
            hideLoading();
            statusInfo.textContent = '이름 변경 실패';
        });
    });
}


// 파일 업로드 기능 초기화
function initFileUpload() {
    fileUploadInput.addEventListener('change', (e) => {
        const files = e.target.files;

        if (!files || files.length === 0) return;

        // 파일 크기 제한 확인
        const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB
        let hasLargeFile = false;
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > maxFileSize) {
                alert(`파일 크기가 너무 큽니다: ${files[i].name} (${formatFileSize(files[i].size)})
최대 파일 크기: 10GB`);
                hasLargeFile = true;
                break;
            }
        }

        if (hasLargeFile) {
            e.target.value = ''; // 파일 입력 초기화
            return;
        }

        // 업로드 소스 설정 및 카운터 초기화
        uploadSource = 'button';
        uploadButtonCounter = 0;

        // FileList를 { file: File, relativePath: string } 형태의 배열로 변환
        const filesWithPaths = Array.from(files).map(file => ({
            file: file,
            relativePath: file.name // 버튼 업로드는 상대 경로가 파일명 자체
        }));

        uploadFiles(filesWithPaths, currentPath); // 현재 경로에 업로드

        // 파일 입력 초기화
        e.target.value = '';
    });
}

// 잘라내기/붙여넣기 기능 초기화
function initClipboardOperations() {
    // 잘라내기 버튼
    cutBtn.addEventListener('click', cutSelectedItems);
    
    // 붙여넣기 버튼
    pasteBtn.addEventListener('click', pasteItems);
}

// 삭제 기능 초기화
function initDeletion() {
    deleteBtn.addEventListener('click', deleteSelectedItems);
}

// 검색 기능 초기화
function initSearch() {
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const fileName = item.getAttribute('data-name').toLowerCase();
            if (fileName.includes(query)) {
                item.style.display = '';
                } else {
                item.style.display = 'none';
            }
        });
    });
}

// 선택된 파일 다운로드
function downloadSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 단일 파일 다운로드
    if (selectedItems.size === 1) {
        const itemId = [...selectedItems][0];
        const element = document.querySelector(`.file-item[data-id="${itemId}"]`);
        const isFolder = element.getAttribute('data-is-folder') === 'true';
        
        // 단일 파일 경로 생성
        const filePath = currentPath ? `${currentPath}/${itemId}` : itemId;
        const encodedPath = encodeURIComponent(filePath);
        const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
        
        // 폴더인 경우에도 압축하여 다운로드
        if (isFolder) {
            compressAndDownload([itemId]);
            return;
        }
        
        // 일반 파일은 다운로드 - 새 창에서 열기
        window.open(fileUrl, '_blank');
        
        statusInfo.textContent = `${itemId} 다운로드 중...`;
        setTimeout(() => {
            statusInfo.textContent = `${itemId} 다운로드 완료`;
        }, 1000);
        
        return;
    }
    
    // 여러 항목 선택 시 압축하여 다운로드
    compressAndDownload([...selectedItems]);
}

// 여러 파일/폴더를 압축하여 다운로드
function compressAndDownload(itemList) {
    if (!itemList || itemList.length === 0) return;
    
    showLoading();
    statusInfo.textContent = '압축 패키지 준비 중...';
    
    // 기본 파일명 생성 (현재 폴더명 또는 기본명 + 날짜시간)
    const now = new Date();
    const dateTimeStr = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    
    // 현재 폴더명 또는 기본명으로 압축파일명 생성
    const currentFolderName = currentPath ? currentPath.split('/').pop() : 'files';
    const zipName = `${currentFolderName}_${dateTimeStr}.zip`;
    
    // API 요청 데이터
    const requestData = {
        files: itemList,
        targetPath: '',  // 임시 압축 위치는 루트에 생성
        zipName: zipName
    };
    
    // 압축 API 호출
    fetch(`${API_BASE_URL}/api/compress`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
        })
        .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '압축 중 오류가 발생했습니다.');
            });
        }
        return response.json();
    })
    .then(data => {
        // 압축 성공 후 다운로드 시작
        const zipPath = data.zipPath ? `${data.zipPath}/${data.zipFile}` : data.zipFile;
        const encodedZipPath = encodeURIComponent(zipPath);
        const zipUrl = `${API_BASE_URL}/api/files/${encodedZipPath}`;
        
        // 새 창에서 다운로드
        window.open(zipUrl, '_blank');
        
        // 상태 업데이트
        statusInfo.textContent = `${itemList.length}개 항목 압축 다운로드 중...`;
        hideLoading();
        
        // 임시 압축 파일 삭제 (다운로드 시작 후 10초 후)
        setTimeout(() => {
            fetch(`${API_BASE_URL}/api/files/${encodedZipPath}`, {
                method: 'DELETE'
            })
        .then(() => {
                console.log(`임시 압축 파일 삭제됨: ${zipPath}`);
            })
            .catch(err => {
                console.error('임시 압축 파일 삭제 오류:', err);
            });
            
            // 상태 메시지 업데이트
            statusInfo.textContent = `${itemList.length}개 항목 압축 다운로드 완료`;
        }, 10000); // 10초 후 삭제
    })
    .catch(error => {
        // 오류 처리
        console.error('압축 및 다운로드 오류:', error);
        alert(`압축 및 다운로드 중 오류가 발생했습니다: ${error.message}`);
        hideLoading();
        statusInfo.textContent = '다운로드 실패';
    });
}

// 항목 이동
function moveItems(itemIds) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) return;
    
    // 상위 폴더(..)는 제외
    const itemsToMove = itemIds.filter(id => id !== '..');
    
    if (itemsToMove.length === 0) {
        alert('이동할 항목이 없습니다. 상위 폴더는 이동할 수 없습니다.');
        return;
    }
    
    // 클립보드에 추가
    clipboardItems = [];
    itemsToMove.forEach(id => {
        const element = document.querySelector(`.file-item[data-id="${id}"]`);
        if (element) {
            clipboardItems.push({
                name: id,
                isFolder: element.getAttribute('data-is-folder') === 'true',
                originalPath: currentPath
            });
        }
    });
    
    clipboardOperation = 'cut';
    pasteBtn.disabled = false;
}

// 상위 폴더로 이동
function navigateToParentFolder() {
    if (!currentPath) return; // 이미 루트 폴더인 경우
    
    
    // 마지막 슬래시 위치 찾기
    const lastSlashIndex = currentPath.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
        // 슬래시가 없으면 루트 폴더로 이동
        currentPath = '';
                        } else {
        // 슬래시가 있으면 상위 경로로 이동
        currentPath = currentPath.substring(0, lastSlashIndex);
                        }
    
    // 폴더 이동 히스토리 상태 업데이트
    updateHistoryState(currentPath);
    
    // 파일 목록 새로고침
                        loadFiles(currentPath);
    
    // 선택 초기화
    clearSelection();
}

// 브라우저 히스토리 상태 업데이트
function updateHistoryState(path) {
    const state = { path: path };
    const url = new URL(window.location.href);
    url.searchParams.set('path', path);
    
    // 현재 상태 교체
    window.history.pushState(state, '', url);
}

// 브라우저 뒤로가기/앞으로가기 이벤트 처리
function initHistoryNavigation() {
    // 페이지 로드 시 URL에서 경로 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const pathParam = urlParams.get('path');
    
    if (pathParam) {
        currentPath = pathParam;
    }
    
    // 초기 상태 설정
    const initialState = { path: currentPath };
    window.history.replaceState(initialState, '', window.location.href);
    
    // 팝스테이트 이벤트 핸들러
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path !== undefined) {
            currentPath = e.state.path;
            loadFiles(currentPath);
        }
    });
}

// 파일 다운로드 및 실행 함수
function downloadAndOpenFile(fileName) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const encodedPath = encodeURIComponent(filePath);
    const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
    
    // 파일 확장자 확인
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    // 실행 가능 확장자 목록
    const executableTypes = ['exe', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'app', 'vbs', 'jar'];
    
    // 브라우저에서 볼 수 있는 파일 확장자
    const viewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
                          'mp4', 'webm', 'ogg', 'mp3', 'wav', 
                          'pdf', 'txt', 'html', 'htm', 'css', 'js', 'json', 'xml'];
    
    // 실행 가능한 파일인 경우
    if (executableTypes.includes(fileExt)) {
        // 사용자에게 알림
        statusInfo.textContent = `${fileName} 다운로드 중...`;
        
        // 원래 방식으로 복구
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 명시적으로 download 속성 설정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            statusInfo.textContent = `${fileName} 다운로드 완료됨. 파일을 실행하세요.`;
        }, 1000);
    } 
    // 브라우저에서 볼 수 있는 파일인 경우
    else if (viewableTypes.includes(fileExt)) {
        // 직접 보기 모드로 URL 생성 (view=true 쿼리 파라미터 추가)
        const viewUrl = `${API_BASE_URL}/api/files/${encodedPath}?view=true`;
        // 새 창에서 열기
        window.open(viewUrl, '_blank');
        statusInfo.textContent = `${fileName} 파일 열기`;
    } 
    // 그 외 파일은 단순 다운로드
        else {
        // 원래 방식으로 복구
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 명시적으로 download 속성 설정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        statusInfo.textContent = `${fileName} 다운로드 중...`;
        
        setTimeout(() => {
            statusInfo.textContent = `${fileName} 다운로드 완료`;
        }, 1000);
    }
}

// 애플리케이션 초기화
}

// 페이지 로드 시 애플리케이션 초기화

// 선택한 파일 압축
function compressSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 선택된 파일/폴더 중 첫 번째 항목의 이름 가져오기
    const selectedItemsArray = Array.from(selectedItems);
    const firstItemName = selectedItemsArray[0];
    
    // 파일 크기 확인
    let hasLargeFile = false;
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    
    for (const item of selectedItemsArray) {
        const fileInfo = fileInfoMap.get(item);
        if (fileInfo && fileInfo.type === 'file' && fileInfo.size > MAX_FILE_SIZE) {
            hasLargeFile = true;
            break;
        }
    }
    
    if (hasLargeFile) {
        alert('500MB 이상의 파일이 포함되어 있어 압축할 수 없습니다.');
        return;
    }
    
    // 현재 날짜와 시간을 문자열로 변환
    const now = new Date();
    const dateTimeStr = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    
    // 기본 압축 파일 이름 설정 (첫 번째 선택 항목 + 날짜시간)
    const defaultZipName = `${firstItemName}_${dateTimeStr}`;
    
    // 압축 파일 이름 입력 받기
    const zipName = prompt('압축 파일 이름을 입력하세요:', defaultZipName);
    if (!zipName) return; // 취소한 경우
    
    showLoading();
    statusInfo.textContent = '압축 중...';
    
    // 압축할 파일 목록 생성
    const filesToCompress = selectedItemsArray;
    
    // API 요청 데이터
    const requestData = {
        files: filesToCompress,
        targetPath: currentPath,
        zipName: zipName
    };
    
    // 압축 API 호출
    fetch(`${API_BASE_URL}/api/compress`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '압축 중 오류가 발생했습니다.');
            });
        }
        return response.json();
    })
    .then(data => {
        // 성공 처리
        statusInfo.textContent = `${filesToCompress.length}개 항목이 ${data.zipFile}로 압축되었습니다.`;
        hideLoading();
        
        // 압축 후 파일 목록 새로고침
        loadFiles(currentPath);
        })
        .catch(error => {
        // 오류 처리
        console.error('압축 오류:', error);
        statusInfo.textContent = `압축 실패: ${error.message}`;
        alert(`압축 실패: ${error.message}`);
        hideLoading();
    });
}








// 정렬 아이콘 가져오기
function getSortIcon(field) {
    if (field !== sortField) return '';
    return sortDirection === 'asc' ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>';
}

// 파일 아이콘 클래스 가져오기
function getFileIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    // 파일 확장자별 아이콘 클래스
    const iconMap = {
        'pdf': 'far fa-file-pdf',
        'doc': 'far fa-file-word',
        'docx': 'far fa-file-word',
        'xls': 'far fa-file-excel',
        'xlsx': 'far fa-file-excel',
        'ppt': 'far fa-file-powerpoint',
        'pptx': 'far fa-file-powerpoint',
        'jpg': 'far fa-file-image',
        'jpeg': 'far fa-file-image',
        'png': 'far fa-file-image',
        'gif': 'far fa-file-image',
        'txt': 'far fa-file-alt',
        'zip': 'far fa-file-archive',
        'rar': 'far fa-file-archive',
        'mp3': 'far fa-file-audio',
        'wav': 'far fa-file-audio',
        'mp4': 'far fa-file-video',
        'mov': 'far fa-file-video',
        'js': 'far fa-file-code',
        'html': 'far fa-file-code',
        'css': 'far fa-file-code',
        'json': 'far fa-file-code',
    };
    
    return iconMap[ext] || 'far fa-file';
}

// 파일 크기 포맷
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
}

// 날짜 포맷
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// 경로 표시 업데이트
function updateBreadcrumb(path) {
    const parts = path.split('/').filter(part => part);
    let breadcrumbHTML = '<span data-path="">홈</span>';
    let currentPathBuilt = '';
    
    parts.forEach((part, index) => {
        currentPathBuilt += (index === 0) ? part : `/${part}`;
        breadcrumbHTML += ` / <span data-path="${currentPathBuilt}">${part}</span>`;
    });
    
    breadcrumb.innerHTML = breadcrumbHTML;
    
    // 경로 클릭 이벤트
    breadcrumb.querySelectorAll('span').forEach(span => {
        span.addEventListener('click', () => {
            currentPath = span.getAttribute('data-path');
            // 히스토리 상태 업데이트 추가
            updateHistoryState(currentPath);
            loadFiles(currentPath);
            
            // 선택 초기화
            clearSelection();
        });
    });
}

// 파일 클릭 처리
function handleFileClick(e, fileItem) {
    // 우클릭은 무시 (컨텍스트 메뉴용)
    if (e.button === 2) return;
    
    // 이름 변경 중이면 무시
    if (fileItem.classList.contains('renaming')) return;
    
    // 상위 폴더는 선택 처리하지 않음
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        return;
    }
    
    // Ctrl 또는 Shift 키로 다중 선택
    if (e.ctrlKey) {
        if (fileItem.classList.contains('selected')) {
            fileItem.classList.remove('selected');
            selectedItems.delete(fileItem.getAttribute('data-name'));
        } else {
            fileItem.classList.add('selected');
            selectedItems.add(fileItem.getAttribute('data-name'));
        }
    } else if (e.shiftKey && selectedItems.size > 0) {
        // Shift 키로 범위 선택
        const items = Array.from(document.querySelectorAll('.file-item:not([data-parent-dir="true"])'));
        const firstSelected = items.findIndex(item => item.classList.contains('selected'));
        const currentIndex = items.indexOf(fileItem);
        
        // 범위 설정
        const start = Math.min(firstSelected, currentIndex);
        const end = Math.max(firstSelected, currentIndex);
        
        clearSelection();
        
        for (let i = start; i <= end; i++) {
            items[i].classList.add('selected');
            selectedItems.add(items[i].getAttribute('data-name'));
        }
    } else {
        // 일반 클릭: 단일 선택
        const fileName = fileItem.getAttribute('data-name');
        
        // 모든 선택 해제 후 현재 항목 선택
        clearSelection();
        fileItem.classList.add('selected');
        selectedItems.add(fileName);
    }
    
    updateButtonStates();
}

// 파일 더블클릭 처리
function handleFileDblClick(e, fileItem) {
    // 이벤트 버블링 방지
    e.preventDefault();
    e.stopPropagation();
    
    // 더블클릭 이벤트가 비활성화된 상태이면 무시
    if (window.doubleClickEnabled === false) {
        console.log('더블클릭 이벤트가 비활성화 상태입니다.');
        return;
    }
    
    const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
    const fileName = fileItem.getAttribute('data-name');
    const isParentDir = fileItem.getAttribute('data-parent-dir') === 'true';
    
    console.log(`더블클릭 이벤트 발생: ${fileName}, 폴더: ${isFolder}, 상위폴더: ${isParentDir}`);
    
    // 상위 폴더 처리
    if (isParentDir) {
        // 더블클릭 이벤트를 비활성화하고 탐색 진행
        window.doubleClickEnabled = false;
        navigateToParentFolder();
        return;
    }
    
    if (isFolder) {
        // 폴더로 이동 전에 더블클릭 비활성화
        window.doubleClickEnabled = false;
        // 폴더로 이동
        navigateToFolder(fileName);
    } else {
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

// 폴더 탐색
function navigateToFolder(folderName) {
    let newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    currentPath = newPath;
    
    // 폴더 이동 히스토리 상태 업데이트
    updateHistoryState(currentPath);
    
    // 이전 더블클릭 이벤트 리스너 제거를 위해 기존 파일 항목 캐시
    const oldFileItems = document.querySelectorAll('.file-item, .file-item-grid');
    oldFileItems.forEach(item => {
        const clonedItem = item.cloneNode(true);
        item.parentNode.replaceChild(clonedItem, item);
    });
    
    // 파일 목록 로드 전에 마우스 포인터 상태 리셋
    document.querySelectorAll('.file-item, .file-item-grid').forEach(item => {
        if (item.classList) {
            item.classList.remove('hover');
        }
    });
    
    // 마우스 포인터 위치 재설정을 위한 강제 mousemove 이벤트 등록
    // 파일 목록이 로드된 후 실행하기 위해 타이머 설정
    setTimeout(() => {
        try {
            // 마우스 위치가 있을 경우에만 이벤트 발생
            if (typeof window.mouseX === 'number' && typeof window.mouseY === 'number') {
                // 마우스 이벤트 강제 발생 
                const mouseEvent = new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: window.mouseX,
                    clientY: window.mouseY
                });
                document.dispatchEvent(mouseEvent);
            }
        } catch (error) {
            console.error('마우스 이벤트 강제 발생 중 오류:', error);
        }
    }, 350);
    
    // 파일 목록 로드
    loadFiles(newPath);
    
    // 선택 초기화
    clearSelection();
}

// 이름 변경 다이얼로그 표시
function showRenameDialog() {
    if (selectedItems.size !== 1) return;
    
    const selectedItem = document.querySelector('.file-item.selected');
    const currentName = selectedItem.getAttribute('data-name');
}
// 선택 항목 삭제 (백그라운드 처리 UX 개선)
async function deleteSelectedItems() { // async 키워드 추가
    if (selectedItems.size === 0) return;

    const itemList = Array.from(selectedItems);
    const itemCount = itemList.length;

    // 잠긴 폴더 확인 (기존 로직 유지)
    const hasRestrictedItems = itemList.some(itemName => {
        const itemPath = currentPath ? `${currentPath}/${itemName}` : itemName;
        return isPathAccessRestricted(itemPath);
    });
    if (hasRestrictedItems) {
        alert('잠긴 폴더 또는 파일은 삭제할 수 없습니다.');
        return;
    }

    if (!confirm(`선택한 ${itemCount}개 항목을 삭제하시겠습니까?\n(대용량 폴더는 백그라운드에서 처리됩니다.)`)) {
        return;
    }

    showLoading();
    statusInfo.textContent = `삭제 요청 중... (0/${itemCount})`;

    let successCount = 0;
    let failureCount = 0;
    const itemsToDeleteUI = []; // UI에서 숨길 항목들

    // 모든 삭제 요청을 병렬로 보냄
    const deletePromises = itemList.map(async (itemName, index) => {
        const itemPath = currentPath ? `${currentPath}/${itemName}` : itemName;
        const encodedPath = encodeURIComponent(itemPath);

        try {
            const response = await fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
                method: 'DELETE'
            });

            statusInfo.textContent = `삭제 요청 중... (${index + 1}/${itemCount})`;

            // 202 (Accepted) 또는 200/204 (OK/No Content)면 성공으로 간주하고 UI에서 숨김
            if (response.status === 202 || response.status === 200 || response.status === 204) {
                console.log(`'${itemName}' 삭제 요청 성공 (상태: ${response.status})`);
                successCount++;
                // UI에서 숨길 항목 추가
                const element = document.querySelector(`.file-item[data-name=\"${CSS.escape(itemName)}\"]`);
                if (element) itemsToDeleteUI.push(element);
            } else {
                // 기타 응답은 실패로 간주
                failureCount++;
                const errorText = await response.text();
                console.error(`'${itemName}' 삭제 요청 실패: ${response.status} ${errorText}`);
                // 실패한 항목은 UI에 그대로 둠 (오류 메시지는 아래에서 한번에)
            }
        } catch (error) {
            failureCount++;
            console.error(`'${itemName}' 삭제 요청 오류:`, error);
        }
    });

    // 모든 요청이 완료될 때까지 기다림
    await Promise.all(deletePromises);

    hideLoading();

    // 성공한 항목들 UI에서 숨기기
    itemsToDeleteUI.forEach(element => {
        element.remove(); // 또는 element.style.display = 'none';
    });
  
      // *** 삭제 후 파일 목록 확인 및 빈 메시지 표시 로직 수정 (메시지 상단 표시) ***
      const remainingItems = fileList.querySelectorAll('.file-item, .file-item-grid');
      if (remainingItems.length === 0) {
          const header = fileList.querySelector('.file-list-header');
          const emptyMessageElement = document.createElement('p');
          emptyMessageElement.className = 'empty-message';
          emptyMessageElement.textContent = '파일이 없습니다';

          // 기존 파일 아이템과 메시지 모두 제거 (중복 방지)
          fileList.querySelectorAll('.file-item, .empty-message').forEach(el => el.remove());

          if (listView && header) { // 목록 보기 상태이고 헤더가 있으면
              // 헤더 바로 다음에 메시지 삽입
              header.insertAdjacentElement('afterend', emptyMessageElement);
          } else { // 격자 보기 또는 헤더 없는 경우
               // fileList의 가장 처음에 메시지 삽입
              fileList.innerHTML = ''; // 일단 비우고
              fileList.appendChild(emptyMessageElement); // 맨 위에 추가
              if(header) fileList.insertBefore(header, emptyMessageElement); // 격자보기였다면 헤더가 없을수 있으므로 확인 후 헤더 복구(필요시) - 격자보기에선 헤더 필요없을듯
          }
          // 상태바 정보 업데이트
          statusInfo.textContent = '0개 항목';
      } else {
          // 남은 항목 수 업데이트
          statusInfo.textContent = `${remainingItems.length}개 항목`;
          // 혹시 이전에 표시된 빈 메시지가 있다면 제거
          const emptyMessageElement = fileList.querySelector('.empty-message');
          if (emptyMessageElement) {
              emptyMessageElement.remove();
          }
      }
      // *** 로직 수정 끝 ***


    // 선택 해제
    clearSelection();
    selectedItems.clear(); // Set 비우기
    updateButtonStates();

    // 최종 상태 메시지 표시
    let finalMessage = '';
    if (failureCount > 0) {
        finalMessage = `${successCount}개 항목 삭제 요청 성공, ${failureCount}개 실패.`;
        alert(`일부 항목 삭제 요청에 실패했습니다. 로그를 확인하세요.`); // 간단한 알림
    } else {
        finalMessage = `${successCount}개 항목 삭제 작업이 백그라운드에서 시작되었습니다.`;
    }
    statusInfo.textContent = finalMessage;

    // 중요: 여기서 loadFiles()를 호출하지 않음!
    // 필요하다면 몇 초 후 새로고침하는 타이머 추가 가능
    // setTimeout(() => loadFiles(currentPath), 15000); // 예: 15초 후 새로고침
}

  
// 항목 붙여넣기
function pasteItems() {
    if (clipboardItems.length === 0) return;
    
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
            console.log(`이동 요청: 소스=${sourcePath}, 대상 경로=${targetPathBase}, 파일명=${item.name}, 현재경로=${currentPath}`);
            
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
            loadFiles(currentPath);
            statusInfo.textContent = `${promises.length}개 항목 붙여넣기 완료`;
            hideLoading();
        })

        .catch(error => {
            alert(`오류 발생: ${error.message}`);
            hideLoading();
            loadFiles(currentPath);
        });
}

// 드래그 시작 처리
function handleDragStart(e, fileItem) {
    console.log('드래그 시작:', fileItem.getAttribute('data-name'));

    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }

    // 드래그 데이터 설정
    e.dataTransfer.effectAllowed = 'move';
    
    // 단일 항목 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 내부 파일 드래그임을 표시하는 데이터 추가
    e.dataTransfer.setData('application/webdav-internal', 'true');
    
    // 드래그 중 스타일 적용
    setTimeout(() => {
        document.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.add('dragging');
        });
    }, 0);
    
    isDragging = true;
}



    
    
    function handleFileDragLeave(e) {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        // e.relatedTarget은 마우스가 이동해 들어간 요소를 가리킵니다.
        // 마우스가 fileItem 요소 또는 그 자식 요소가 아닌 곳으로 이동했을 때만 클래스를 제거합니다.
        if (!e.relatedTarget || !fileItem.contains(e.relatedTarget)) {
        fileItem.classList.remove('drag-over');
        }
    }
    
    // clearAllDragOverClasses 함수가 앞에서 정의되어 있지 않으면 정의
    if (typeof clearAllDragOverClasses !== 'function') {
        function clearAllDragOverClasses() {
            document.querySelectorAll('.file-item.drag-over').forEach(item => {
                item.classList.remove('drag-over');
            });
        }
    }

    // 이미 handleFileDragEnter 함수가 정의되어 있지 않으면 정의
    if (typeof handleFileDragEnter !== 'function') {
        function handleFileDragEnter(e) {
            const fileItem = e.target.closest('.file-item');
            if (!fileItem) {
                clearAllDragOverClasses();
                return;
            }
            
            if (fileItem.getAttribute('data-is-folder') === 'true' && !fileItem.classList.contains('selected')) {
                clearAllDragOverClasses();
                fileItem.classList.add('drag-over');
            } else {
                clearAllDragOverClasses();
            }
        }
    }
    
    // handleFileDragOver 함수가 정의되어 있지 않으면 정의
    if (typeof handleFileDragOver !== 'function') {
        function handleFileDragOver(e) {
            e.preventDefault(); // 드롭 허용
            e.stopPropagation(); // 이벤트 버블링 방지
            
            // 모든 drag-over 클래스 먼저 제거
            if (typeof clearAllDragOverClasses === 'function') {
                clearAllDragOverClasses();
            } else {
                document.querySelectorAll('.file-item.drag-over').forEach(item => {
                    item.classList.remove('drag-over');
                });
            }
            
            const fileItem = e.target.closest('.file-item');
            
            // 파일 항목이 없으면 종료
            if (!fileItem) return;
            
            // 폴더이고 선택되지 않은 경우에만 처리
            if (fileItem.getAttribute('data-is-folder') === 'true' && !fileItem.classList.contains('selected')) {
                // 폴더에 드래그 오버 스타일 적용
                fileItem.classList.add('drag-over');
                
                // 기본 드롭 효과 설정
                e.dataTransfer.dropEffect = 'move';
            }
        }
    }
    
    // handleFileDragLeave 함수가 정의되어 있지 않으면 정의
    if (typeof handleFileDragLeave !== 'function') {
        function handleFileDragLeave(e) {
            // 빈 함수로 유지
        }
    }

    // handleFileDrop 함수가 정의되어 있지 않으면 정의
    if (typeof handleFileDrop !== 'function') {
        function handleFileDrop(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // drag-over 클래스 초기화
            if (typeof clearAllDragOverClasses === 'function') {
                clearAllDragOverClasses();
            }
        }
    }

    fileList.addEventListener('dragover', handleFileDragOver);
    fileList.addEventListener('dragleave', handleFileDragLeave);
    fileList.addEventListener('drop', handleFileDrop);
    
    // 전체 영역 드롭존 이벤트 함수들
function handleDropZoneDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 모든 드래그 이벤트에 대해 드롭존 활성화
        // 드롭 시점에 내부/외부 판단
        if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')) {
            dropZone.classList.add('active');
        }
    }
    
function handleDropZoneDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 모든 드래그 이벤트에 대해 드롭존 유지
        // 드롭 시점에 내부/외부 판단
        if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')) {
            // 기본 드롭 효과 설정 (드롭 후 판단)
            const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
            e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
            dropZone.classList.add('active');
        }
    }
    
function handleDropZoneDragLeave(e) {
        // relatedTarget이 null이거나 dropZone의 자식 요소가 아닌 경우에만 비활성화
    if (!dropZone.contains(e.relatedTarget)) {
            dropZone.classList.remove('active');
    }
}

function handleDropZoneDrop(e) {
    console.log('드롭존에 파일 드롭됨');
    preventDefaults(e);
    
    // 드래그 상태 초기화
    window.draggingInProgress = false;
    
    // 내부/외부 파일 판단
    const { isExternalDrop, isInternalDrop, draggedPaths, reason } = determineDropType(e);
    
    // 최종 판단: 외부 파일이 있으면 외부 드롭으로 처리
    if (isExternalDrop) {
        console.log('드롭존 드롭 - 외부 파일 드롭 처리');
        handleExternalFileDrop(e, currentPath);
    } 
    // 내부 파일이라도 경로가 비어있으면 오류 처리
    else if (isInternalDrop && draggedPaths.length > 0) {
        console.log('드롭존 드롭 - 내부 파일 이동 처리:', draggedPaths);
        // 현재 드롭존의 경로로 파일 이동
        handleInternalFileDrop(draggedPaths, { path: currentPath });
    }
    // 판단 불가능한 경우
    else {
        console.log('드롭존 드롭 - 처리할 수 없는 드롭 데이터');
        showToast('처리할 수 없는 드롭 데이터입니다.', 'error');
        
    }
    
    // 전체 영역 드롭존 이벤트 리스너 등록
    window.removeEventListener('dragenter', handleDropZoneDragEnter);
    window.removeEventListener('dragover', handleDropZoneDragOver);
    window.removeEventListener('dragleave', handleDropZoneDragLeave);
    dropZone.removeEventListener('drop', handleDropZoneDrop);
    
    console.log('드롭존 이벤트 리스너 등록 완료 (handleDrop 이벤트는 initDropZone에서 등록)');
    
    // 개발 모드에서 폴더 항목 CSS 선택자 유효성 확인
    console.log('폴더 항목 개수:', document.querySelectorAll('.file-item[data-is-folder="true"]').length);
}

// 내부 드래그인지 확인하는 함수 (파일 경로 기반 + 기본값은 내부)
function isInternalDrag(e) {
    // 공통 함수를 재사용하여 드래그 타입 판단
    if (!e || !e.dataTransfer) return true; // 기본값은 내부
    
    // 결정적인 외부 파일 증거: File 객체가 존재하면 무조건 외부 파일로 판단
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        return false; // 외부 파일
    }
    
    // 내부 드래그 마커가 있으면 확실한 내부 파일
    if (e.dataTransfer.types.includes('application/x-internal-drag')) {
        return true;
    }

    // 내부 드래그 진행 상태 확인 (전역 변수)
    if (window.draggingInProgress) {
        return true;
    }
    
    // 기본값은 내부로 판단 (확실한 외부 증거가 없으면)
    return true;
}

// 내부 파일 드롭 처리 함수 (실제 이동 로직 구현)
async function handleInternalFileDrop(draggedItemPaths, targetFolderItem) {
    console.log('[Internal Drop] 내부 파일 이동 처리 시작:', draggedItemPaths);

    // 타겟 폴더 경로 결정
    let targetPath = currentPath;
    let targetName = '현재 폴더';
    
    if (targetFolderItem) {
        // 타겟 폴더가 주어진 경우 (파일 항목에 드롭된 경우)
        const folderName = targetFolderItem.getAttribute('data-name');
        targetPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        targetName = folderName;
    }
    
    console.log(`[Internal Drop] 타겟 경로: ${targetPath}, 타겟 이름: ${targetName}`);
    
    // 드래그된 데이터가 유효한지 확인
    if (!Array.isArray(draggedItemPaths) || draggedItemPaths.length === 0) {
        console.error('[Internal Drop] 유효하지 않은 파일 경로 정보');
        showToast('이동할 항목 정보가 유효하지 않습니다.', 'error');
             return;
        }

    // 경로 처리 및 유효성 검사
    const validItemPaths = draggedItemPaths.filter(path => {
        // 경로가 유효한 문자열인지 확인
        if (typeof path !== 'string' || !path.trim()) {
            console.warn('[Internal Drop] 유효하지 않은 경로 제외:', path);
            return false;
        }
        return true;
    });
    
    if (validItemPaths.length === 0) {
        console.error('[Internal Drop] 유효한 경로가 없음');
        showToast('이동할 유효한 항목이 없습니다.', 'error');
        return;
    }
    
    // 경로 처리 및 이름 추출
    const itemsInfo = validItemPaths.map(path => {
        // 경로에서 파일/폴더 이름 추출
        const itemName = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path;
        // 경로에서 부모 경로 추출 (루트는 빈 문자열)
        const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
        
        // fileInfoMap에서 정보 가져오기 (이름으로 조회)
        const itemInfo = fileInfoMap.get(itemName) || null;
        
        return {
            fullPath: path,
            name: itemName,
            parentPath,
            isFolder: itemInfo ? itemInfo.isFolder : false,
            info: itemInfo
        };
    });
    
    console.log('[Internal Drop] 항목 정보:', itemsInfo);
    
    // --- 유효성 검사 시작 ---
    
    // 1. 타겟 폴더가 이동하려는 항목 중 하나인 경우 방지
    if (targetFolderItem) {
        const targetInDraggedItems = itemsInfo.some(item => item.fullPath === targetPath);
        if (targetInDraggedItems) {
            console.warn(`[Internal Drop] 선택된 항목 중 하나인 '${targetName}'(으)로는 이동할 수 없습니다.`);
             showToast(`선택된 항목 중 하나인 '${targetName}'(으)로는 이동할 수 없습니다.`, 'warning');
             return;
        }
    }
    
    // 2. 폴더를 자신의 하위 폴더로 이동하려는 경우 방지
    for (const item of itemsInfo) {
        if (item.isFolder && targetPath.startsWith(item.fullPath + '/')) {
            console.warn(`[Internal Drop] 폴더 '${item.name}'를 자신의 하위 폴더 '${targetName}'(으)로 이동할 수 없습니다.`);
            showToast(`폴더 '${item.name}'를 자신의 하위 폴더 '${targetName}'(으)로 이동할 수 없습니다.`, 'warning');
            return;
        }
    }
    
    // 3. 이미 대상 폴더에 있는 항목 필터링
    const itemsToMove = itemsInfo.filter(item => item.parentPath !== targetPath);
    
    if (itemsToMove.length === 0) {
        console.log('[Internal Drop] 이동할 필요가 있는 항목이 없습니다.');
        showToast('모든 항목이 이미 대상 폴더에 있습니다.', 'info');
        clearSelection();
        return;
    }

    // --- 유효성 검사 끝 ---
    
    // 이동 시작
    console.log(`[Internal Drop] ${itemsToMove.length}개 항목 이동 준비 완료:`, 
                itemsToMove.map(item => item.name));
    
    showLoading();
    try {
        // 실제 항목 이동 (이동할 항목의 전체 경로 배열 전달)
        await moveToFolder(itemsToMove.map(item => item.fullPath), targetPath);
        
        // console.log('[Internal Drop] 이동 작업 성공');
        // showToast(`${itemsToMove.length}개 항목을 '${targetName}'(으)로 이동했습니다.`, 'success');
        
        // 파일 목록 새로고침 (moveToFolder에서 처리하므로 제거)
        // loadFiles(currentPath);
    } catch (error) {
        console.error('[Internal Drop] 이동 중 오류 발생:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`항목 이동 중 오류: ${errorMessage}`, 'error');
        
        // 오류 발생 시에도 파일 목록 새로고침 (moveToFolder에서 처리하므로 제거)
        // loadFiles(currentPath);
    } finally {
        hideLoading();
        clearSelection(); // 이동 후 선택 해제
    }
}

// 외부 파일 드롭 처리 함수

// 외부 파일 드롭 처리 함수
async function handleExternalFileDrop(e, targetFolderItem = null) { // async 키워드 추가
    if (isHandlingDrop) {
        console.log('이미 드롭 처리 중입니다. 중복 호출 방지.');
        return; // 중복 실행 방지
    }
    isHandlingDrop = true; // 처리 시작 플래그 설정

    try {
        // 진행 중인 업로드가 있는지 확인
        if (progressContainer.style.display === 'block') {
            statusInfo.textContent = '이미 업로드가 진행 중입니다. 완료 후 다시 시도하세요.';
            console.log('이미 진행 중인 업로드가 있어 새 업로드를 취소합니다.');
            return;
        }

        // DataTransferItemList 사용
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) {
            console.log('드롭된 항목이 없습니다.');
            return;
        }

        // 업로드 소스 설정 및 카운터 초기화
        uploadSource = 'dragdrop';
        dragDropCounter = 0;

        let targetPath = currentPath; // 기본 업로드 경로는 현재 경로

        // 타겟 폴더가 지정된 경우 경로 업데이트
        if (targetFolderItem) {
            const targetFolder = targetFolderItem.getAttribute('data-name');
            targetPath = currentPath ? `${currentPath}/${targetFolder}` : targetFolder;
            console.log('외부 파일 드래그 감지: 대상 폴더:', targetFolder);
        } else {
            console.log('외부 파일 드래그 감지: 현재 경로에 업로드');
        }

        showLoading();
        statusInfo.textContent = '파일 목록을 읽는 중...';

        const filesWithPaths = [];
        const promises = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    promises.push(traverseFileTree(entry, '', filesWithPaths));
                } else {
                    // webkitGetAsEntry가 지원되지 않는 경우 직접 파일 가져오기
                    const file = item.getAsFile();
                    if (file) {
                        filesWithPaths.push({ file, relativePath: file.name });
                    }
                }
            }
        }

        await Promise.all(promises);

        hideLoading();

        if (filesWithPaths.length === 0) {
            statusInfo.textContent = '업로드할 파일을 찾을 수 없습니다.';
            console.log('업로드할 파일이 없습니다.');
             return;
        }

        console.log(`총 ${filesWithPaths.length}개의 파일 수집 완료.`);
        // uploadFiles 함수 호출 시 targetPath 전달
        uploadFiles(filesWithPaths, targetPath); // 수정: targetPath 전달

    } catch (error) {
        hideLoading();
        statusInfo.textContent = '파일 목록 읽기 오류.';
        console.error('파일 트리 탐색 오류:', error);
        alert('파일 목록을 읽는 중 오류가 발생했습니다.');
    } finally {
        isHandlingDrop = false; // 처리 완료 또는 오류 발생 시 플래그 해제
    }
}

// 파일 트리 탐색 함수 (폴더 포함)
function traverseFileTree(entry, path, filesWithPaths) {
    return new Promise((resolve, reject) => {
        // 경로 이름 길이 제한 확인 및 처리
        const maxPathComponentLength = 220; // 경로 구성요소의 최대 길이 설정
        const maxFullPathLength = 3800; // 전체 경로 최대 길이 (바이트)
        const originalEntryName = entry.name;
        let entryName = originalEntryName;
        
        // 폴더나 파일 이름이 너무 길면 처리
        if (new TextEncoder().encode(entryName).length > maxPathComponentLength) {
            // 폴더인 경우 확장자가 없으므로 단순히 잘라서 처리
            if (entry.isDirectory) {
                // 바이트 단위로 자르기
                let shortName = '';
                const encodedName = new TextEncoder().encode(entryName);
                const maxBytes = maxPathComponentLength - 3; // "..." 공간 확보
                
                // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                let byteCount = 0;
                for (let i = 0; i < entryName.length; i++) {
                    const charBytes = new TextEncoder().encode(entryName[i]).length;
                    if (byteCount + charBytes <= maxBytes) {
                        shortName += entryName[i];
                        byteCount += charBytes;
                    } else {
                        break;
                    }
                }
                
                entryName = shortName + '...';
                console.log(`폴더명이 너무 깁니다. 원본: ${originalEntryName}, 수정됨: ${entryName}`);
            }
            // 파일인 경우는 아래에서 별도 처리
        }

        // 현재 경로 계산
        const currentPath = path ? `${path}/${entryName}` : entryName;
        
        // 전체 경로가 너무 길어질 가능성이 있는지 확인 (바이트 단위로 정확히 계산)
        const pathBytes = new TextEncoder().encode(currentPath).length;
        if (pathBytes > maxFullPathLength / 2) {
            console.warn(`경로가 길어질 가능성이 있습니다: ${currentPath} (${pathBytes} bytes)`);
        }

        if (entry.isFile) {
            entry.file(file => {
                // 숨김 파일 (.으로 시작)은 제외
                if (!file.name.startsWith('.')) {
                    // 파일 이름 길이 체크 및 처리
                    const maxFileNameLength = 220; // 최대 파일명 바이트 길이 설정
                    let fileName = file.name;
                    let relativePath = currentPath;
                    
                    // 파일명 바이트 길이 계산
                    const fileNameBytes = new TextEncoder().encode(fileName).length;
                    
                    // 파일명이 너무 길면 잘라내기
                    if (fileNameBytes > maxFileNameLength) {
                        const extension = fileName.lastIndexOf('.') > 0 ? fileName.substring(fileName.lastIndexOf('.')) : '';
                        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.') > 0 ? fileName.lastIndexOf('.') : fileName.length);
                        
                        // 바이트 기준으로 이름 자르기
                        let shortName = '';
                        const maxBytes = maxFileNameLength - new TextEncoder().encode(extension).length - 3; // "..." 공간 확보
                        
                        // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                        let byteCount = 0;
                        for (let i = 0; i < fileNameWithoutExt.length; i++) {
                            const charBytes = new TextEncoder().encode(fileNameWithoutExt[i]).length;
                            if (byteCount + charBytes <= maxBytes) {
                                shortName += fileNameWithoutExt[i];
                                byteCount += charBytes;
                            } else {
                                break;
                            }
                        }
                        
                        const newFileName = shortName + '...' + extension;
                        
                        // 상대 경로도 수정
                        if (path) {
                            relativePath = `${path}/${newFileName}`;
                        } else {
                            relativePath = newFileName;
                        }
                        
                        console.log(`파일명이 너무 깁니다. 원본: ${fileName}, 수정됨: ${newFileName}`);
                        
                        // 파일 객체를 새로운 이름으로 복제 (File 객체는 직접 수정할 수 없음)
                        const renamedFile = new File([file], newFileName, { type: file.type });
                        filesWithPaths.push({ file: renamedFile, relativePath: relativePath });
                    } else {
                        // 전체 경로 바이트 길이 확인 (UTF-8)
                        const fullPathBytes = new TextEncoder().encode(relativePath).length;
                        
                        if (fullPathBytes > maxFullPathLength) {
                            // 경로가 너무 길면 비상 처리 (파일만 남기고 경로 단축)
                            console.warn(`전체 경로가 너무 깁니다(${fullPathBytes} bytes): ${relativePath}`);
                            
                            // 파일명만 보존하고 경로는 압축
                            const shortenedPath = `긴경로/${fileName}`;
                            console.log(`경로 단축됨: ${relativePath} → ${shortenedPath}`);
                            
                            // 중요: 원본 파일 이름은 유지하되 경로만 변경
                            filesWithPaths.push({ file: file, relativePath: shortenedPath });
                            statusInfo.textContent = `일부 파일의 경로가 너무 길어 단축되었습니다.`;
                        } else {
                            // 정상 경로
                            filesWithPaths.push({ file: file, relativePath: relativePath });
                            console.log(`파일 추가: ${relativePath}`);
                        }
                    }
                } else {
                    console.log(`숨김 파일 제외: ${currentPath}`);
                }
                resolve();
            }, err => {
                console.error(`파일 읽기 오류 (${currentPath}):`, err);
                reject(err); // 오류 발생 시 reject 호출
            });
        } else if (entry.isDirectory) {
            // 숨김 폴더 (.으로 시작)는 제외
            if (entry.name.startsWith('.')) {
                console.log(`숨김 폴더 제외: ${currentPath}`);
                resolve(); // 숨김 폴더는 처리하지 않고 resolve
        return;
    }
    
            // 전체 경로 바이트 길이 확인 (UTF-8)
            const fullPathBytes = new TextEncoder().encode(currentPath).length;
            
            if (fullPathBytes > maxFullPathLength) {
                console.warn(`폴더 경로가 너무 깁니다(${fullPathBytes} bytes). 접근 가능한 경로로 단축: ${currentPath}`);
                statusInfo.textContent = `일부 폴더의 경로가 너무 길어 단축되었습니다.`;
                
                // 폴더명 단축 버전 생성 (폴더명 앞부분 + "..." 형태로)
                // UTF-8 바이트 길이를 고려하여 자름
                let shortName = '';
                const maxBytes = 20; // 짧게 유지
                
                // UTF-8은 문자당 1~4바이트, 문자 경계를 보존하며 자름
                let byteCount = 0;
                for (let i = 0; i < entry.name.length; i++) {
                    const charBytes = new TextEncoder().encode(entry.name[i]).length;
                    if (byteCount + charBytes <= maxBytes) {
                        shortName += entry.name[i];
                        byteCount += charBytes;
                    } else {
                        break;
                    }
                }
                
                const shortenedDirName = shortName + "...";
                const shortenedPath = path ? `${path}/${shortenedDirName}` : shortenedDirName;
                
                console.log(`폴더 경로 단축됨: ${currentPath} → ${shortenedPath}`);
                
                // 단축된 경로로 계속 진행
                const dirReader = entry.createReader();
                let allEntries = [];

                const readEntries = () => {
                    dirReader.readEntries(entries => {
                        if (entries.length === 0) {
                            // 모든 항목을 읽었으면 재귀 호출 실행
                            Promise.all(allEntries.map(subEntry => {
                                return traverseFileTree(subEntry, shortenedPath, filesWithPaths);
                            }))
                                .then(resolve)
                                .catch(reject);
                        } else {
                            // 읽은 항목을 allEntries에 추가하고 계속 읽기
                            allEntries = allEntries.concat(entries);
                            readEntries();
                        }
                    }, err => {
                        console.error(`폴더 읽기 오류 (${shortenedPath}):`, err);
                        reject(err);
                    });
                };
                readEntries();
             return;
        }
        
        console.log(`폴더 탐색: ${currentPath}`);
        const dirReader = entry.createReader();
        let allEntries = [];

        const readEntries = () => {
            dirReader.readEntries(entries => {
                if (entries.length === 0) {
                    // 모든 항목을 읽었으면 재귀 호출 실행
                    Promise.all(allEntries.map(subEntry => {
                        // 원본 entry 이름이 변경된 경우 하위 항목의 상대 경로 계산에도 적용
                        const subPath = originalEntryName !== entryName ? 
                            (currentPath) : 
                            (path ? `${path}/${entry.name}` : entry.name);
                        return traverseFileTree(subEntry, subPath, filesWithPaths);
                    }))
                        .then(resolve)
                        .catch(reject); // 하위 탐색 중 오류 발생 시 reject
                } else {
                    // 읽은 항목을 allEntries에 추가하고 계속 읽기
                    allEntries = allEntries.concat(entries);
                    readEntries(); // 재귀적으로 호출하여 모든 항목 읽기
                }
            }, err => {
                console.error(`폴더 읽기 오류 (${currentPath}):`, err);
                reject(err); // 폴더 읽기 오류 시 reject
            });
        };
        readEntries();
    } else {
        console.warn(`알 수 없는 항목 타입: ${entry.name}`);
        resolve(); // 알 수 없는 타입은 무시하고 resolve
    }
});
}


// 특정 폴더에 파일 업로드 (files 인자 변경: File[] -> { file: File, relativePath: string }[])
// targetUploadPath 인자 추가
function uploadFiles(filesWithPaths, targetUploadPath = currentPath) {
    if (!filesWithPaths || filesWithPaths.length === 0) return;

    // 호출 카운터 증가 - 오직 새로운 업로드 세션에서만 증가
    // uploadSource는 handleExternalFileDrop 또는 파일 입력 변경 리스너에서 설정됨
    if (uploadSource === 'button') {
        uploadButtonCounter++;
        console.log(`버튼 업로드 호출 횟수: ${uploadButtonCounter}, 파일 수: ${filesWithPaths.length}`);
        statusInfo.textContent = `버튼 업로드 호출 횟수: ${uploadButtonCounter}, 파일 수: ${filesWithPaths.length}`;
    } else if (uploadSource === 'dragdrop') {
        dragDropCounter++;
        console.log(`드래그앤드롭 업로드 호출 횟수: ${dragDropCounter}, 파일 수: ${filesWithPaths.length}`);
        statusInfo.textContent = `드래그앤드롭 업로드 호출 횟수: ${dragDropCounter}, 파일 수: ${filesWithPaths.length}`;
    }

    // 진행 중 업로드가 있으면 종료 처리
    if (progressContainer.style.display === 'block') {
        console.log('이미 진행 중인 업로드가 있어 새 업로드를 취소합니다.');
            return;
        }

    // 업로드 UI 표시
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    // 전체 파일 크기와 현재까지 업로드된 크기를 추적
    const totalFiles = filesWithPaths.length;
    let totalSize = 0;
    let currentFileIndex = 0; // 현재 처리 중인 파일 인덱스

    // 모든 파일 정보 배열 생성 (상대 경로 포함)
    let fileInfoArray = [];
    filesWithPaths.forEach(({ file, relativePath }, index) => {
        fileInfoArray.push({
            originalName: file.name,
            relativePath: relativePath,
            size: file.size,
            index: index // FormData에서 파일을 찾기 위한 인덱스
        });
        totalSize += file.size;
    });

    // 현재 처리 중인 파일 정보 업데이트 함수
    function updateCurrentFileInfo() {
        if (currentFileIndex < filesWithPaths.length) {
            const currentFile = filesWithPaths[currentFileIndex].file;
            const fileSize = formatFileSize(currentFile.size);
            document.getElementById('currentFileUpload').textContent = `${currentFile.name} (${fileSize}) - 총 ${formatFileSize(totalSize)}`;
            document.getElementById('currentFileUpload').style.display = 'block';
        }
    }

    // 첫 번째 파일 정보 표시
    updateCurrentFileInfo();

    // 시작 시간 기록
    const startTime = new Date().getTime();

    // FormData에 모든 파일과 정보 추가
    const formData = new FormData();
    formData.append('path', targetUploadPath); // 기본 업로드 경로 (폴더 드롭 시 해당 폴더 경로)

    filesWithPaths.forEach(({ file }, index) => {
        formData.append(`file_${index}`, file); // 각 파일을 고유한 키로 추가
    });
    formData.append('fileInfo', JSON.stringify(fileInfoArray)); // 파일 정보 배열 추가 (상대 경로 포함)

    console.log('FormData 생성 완료. 업로드 시작...');
    console.log('업로드 대상 경로:', targetUploadPath);
    console.log('파일 정보:', fileInfoArray);


    // AJAX 요청으로 파일 전송
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/upload`);

    // 업로드 완료 플래그
    let uploadCompleted = false;
    let lastLoaded = 0; // 이전 파일까지 누적된 업로드 바이트
    let currentFileCumulativeSize = 0; // 현재 파일 시작 시점까지의 누적 크기

    xhr.upload.onprogress = (e) => {
        // 업로드가 이미 완료된 상태라면 진행률 업데이트 중지
        if (uploadCompleted) return;

        if (e.lengthComputable) {
            const loadedSoFar = e.loaded; // 현재까지 총 업로드된 바이트

            // 현재 처리 중인 파일 업데이트 로직 수정
            while (currentFileIndex < filesWithPaths.length &&
                   loadedSoFar >= currentFileCumulativeSize + filesWithPaths[currentFileIndex].file.size) {
                currentFileCumulativeSize += filesWithPaths[currentFileIndex].file.size;
                currentFileIndex++;
                updateCurrentFileInfo(); // 다음 파일 정보 표시
            }

            // 전체 업로드 진행률 계산
            const totalProgress = (loadedSoFar / e.total) * 100;

            // 업로드 속도 및 남은 시간 계산
            const currentTime = new Date().getTime();
            const elapsedTimeSeconds = (currentTime - startTime) / 1000 || 1; // 0으로 나누는 것 방지
            const uploadSpeed = loadedSoFar / elapsedTimeSeconds; // bytes per second
            const uploadSpeedFormatted = formatFileSize(uploadSpeed) + '/s';

            // 업로드가 거의 완료되면 진행률을 99%로 고정
            let progressValue = totalProgress;
            if (progressValue > 99 && loadedSoFar < e.total) progressValue = 99;
            if (loadedSoFar === e.total) progressValue = 100; // 완료 시 100%

            let remainingTime = (e.total - loadedSoFar) / uploadSpeed; // 남은 시간(초)
            if (remainingTime < 0 || !Number.isFinite(remainingTime)) remainingTime = 0;

            let timeDisplay;

            if (remainingTime < 60) {
                timeDisplay = `${Math.round(remainingTime)}초`;
            } else if (remainingTime < 3600) {
                timeDisplay = `${Math.floor(remainingTime / 60)}분 ${Math.round(remainingTime % 60)}초`;
            } else {
                timeDisplay = `${Math.floor(remainingTime / 3600)}시간 ${Math.floor((remainingTime % 3600) / 60)}분`;
            }

            // 진행률 표시 업데이트
            progressBar.style.width = `${progressValue}%`;

            // 업로드 상태 메시지 업데이트
            let progressStatusText = "";
             // currentFileIndex가 배열 범위를 벗어나지 않도록 확인
            const displayFileIndex = Math.min(currentFileIndex + 1, totalFiles);

            if (totalFiles === 1) {
                progressStatusText = `파일 업로드 중 - ${Math.round(progressValue)}% 완료 (${uploadSpeedFormatted}, 남은 시간: ${timeDisplay})`;
            } else {
                progressStatusText = `${displayFileIndex}/${totalFiles} 파일 업로드 중 - ${Math.round(progressValue)}% 완료 (${uploadSpeedFormatted}, 남은 시간: ${timeDisplay})`;
            }
            uploadStatus.textContent = progressStatusText;
            uploadStatus.style.display = 'block';

            // 현재 상태 업데이트
            statusInfo.textContent = `파일 업로드 중 (${Math.round(progressValue)}%, ${formatFileSize(loadedSoFar)}/${formatFileSize(e.total)})`;
        }
    };

    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
            // 업로드 완료 플래그 설정
            uploadCompleted = true;

            // 로딩 상태 초기화
            currentFileIndex = 0;
            currentFileCumulativeSize = 0;
            
            // 즉시 업로드 UI 상태 초기화 (타이머 없이 바로 설정)
            progressContainer.style.display = 'none';
            document.getElementById('currentFileUpload').style.display = 'none';

            if (xhr.status === 200 || xhr.status === 201) {
                // 업로드 성공 - 프로그레스바 100%로 설정
                progressBar.style.width = '100%';

                if (totalFiles === 1) {
                    uploadStatus.textContent = '파일 업로드 완료';
                } else {
                    uploadStatus.textContent = `${totalFiles}개 파일 업로드 완료`;
                }

                if (totalFiles === 1) {
                    statusInfo.textContent = '파일 업로드 완료';
                } else {
                    statusInfo.textContent = `${totalFiles}개 파일 업로드 완료`;
                }
                
                // 업로드된 경로로 파일 목록 새로고침
                loadFiles(targetUploadPath);
            } else {
                // 오류 처리
                let errorMsg = '업로드 실패';
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.error) {
                        errorMsg = `업로드 실패: ${response.message || response.error}`;
                    }
                } catch (e) {
                    errorMsg = `업로드 실패: ${xhr.status} ${xhr.statusText || '알 수 없는 오류'}`;
                }

                uploadStatus.textContent = errorMsg;
                statusInfo.textContent = errorMsg;
            }
            
            // 상태 표시 잠시 유지 후 숨김
            setTimeout(() => {
                uploadStatus.style.display = 'none';
            }, 2000);
        }
    };

    xhr.onerror = () => {
        // 업로드 완료 플래그 설정
        uploadCompleted = true;

        // 즉시 업로드 UI 상태 초기화
        progressContainer.style.display = 'none';
        document.getElementById('currentFileUpload').style.display = 'none';
        
        uploadStatus.textContent = `파일 업로드 실패: 네트워크 오류`;
        statusInfo.textContent = `파일 업로드 실패: 네트워크 오류`;

        // 잠시 후 상태 메시지만 숨김
        setTimeout(() => {
            uploadStatus.style.display = 'none';
        }, 2000);
    };

    xhr.send(formData);
}

// 파일/폴더 이동 함수
function moveItem(sourcePath, targetPath, overwrite = false) {
    return new Promise((resolve, reject) => {
        // 파일명 추출
        const fileName = sourcePath.split('/').pop();
        
        // 소스와 타겟이 같은 경로인지 확인
        if (sourcePath === `${targetPath}/${fileName}`) {
            console.log(`[${fileName}] 소스와 타겟이 동일합니다. 무시합니다.`);
            resolve(); // 에러가 아닌 정상 처리로 간주
            return;
        }
        
        console.log(`[${fileName}] 이동 시작: ${sourcePath} -> ${targetPath}, overwrite=${overwrite}`);
        
        // API 요청 - 이미 충돌 확인이 완료되었으므로 바로 API 호출
        return fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(sourcePath)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newName: fileName,
                targetPath: targetPath,
                overwrite: overwrite // 덮어쓰기 옵션
            })
        })
        .then(response => {
            if (response.ok) {
                console.log(`[${fileName}] 이동 성공`);
                resolve();
            } else {
                return response.text().then(text => {
                    console.error(`[${fileName}] 이동 실패:`, text);
                    reject(text || '이동 실패');
                });
            }
        })
        .catch(error => {
            console.error(`[${fileName}] 이동 오류:`, error);
            reject(error.message || '네트워크 오류');
        });
    });
}

// 뷰 모드 전환
function initViewModes() {
    gridViewBtn.addEventListener('click', () => {
        listView = false;
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        loadFiles(currentPath); 
    });
    
    listViewBtn.addEventListener('click', () => {
        listView = true;
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        loadFiles(currentPath);
    });
    
    // 기본값이 리스트뷰라면 초기에 활성화
    if (listView) {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
    } else {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    }
}

// 폴더 생성 기능 초기화
function initFolderCreation() {
    // 새 폴더 버튼
    createFolderBtn.addEventListener('click', () => {
        // 현재 폴더에 존재하는 파일 목록 확인
        const fileItems = document.querySelectorAll('.file-item');
        const existingNames = Array.from(fileItems).map(item => item.getAttribute('data-name'));
        
        // 기본 폴더명 '새폴더'와 중복되지 않는 이름 찾기
        let defaultName = '새폴더';
        let counter = 1;
        
        while (existingNames.includes(defaultName)) {
            defaultName = `새폴더(${counter})`;
            counter++;
        }
        
        // 기본 폴더명 설정
        folderNameInput.value = defaultName;
        folderModal.style.display = 'flex';
        folderNameInput.focus();
        
        // 모든 텍스트를 선택하여 바로 수정할 수 있게 함
        folderNameInput.select();
    });
    
    // 폴더 생성 취소
    cancelFolderBtn.addEventListener('click', () => {
        folderModal.style.display = 'none';
    });
    
    // ESC 키로 폴더 생성 취소
    folderNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            folderModal.style.display = 'none';
            e.preventDefault(); // 이벤트 기본 동작 방지
        }
    });
    
    // Enter 키로 폴더 생성
    folderNameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            createFolderConfirmBtn.click();
        }
    });
    
    // 폴더 생성 확인
    createFolderConfirmBtn.addEventListener('click', () => {
        const folderName = folderNameInput.value.trim();
        
        if (!folderName) {
            alert('폴더 이름을 입력해주세요.');
            return;
        }
        
        const path = currentPath ? `${currentPath}/${folderName}` : folderName;
        // 경로에 한글이 포함된 경우를 위해 인코딩 처리
        const encodedPath = encodeURIComponent(path);
        
        showLoading();
        statusInfo.textContent = '폴더 생성 중...';
        
        fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('이미 존재하는 이름입니다.');
                }
                throw new Error('폴더 생성에 실패했습니다.');
            }
            folderModal.style.display = 'none';
            loadFiles(currentPath); // 파일 목록 새로고침
            statusInfo.textContent = '폴더 생성 완료';
        })
        .catch(error => {
            alert(error.message);
        hideLoading();
            statusInfo.textContent = '폴더 생성 실패';
        });
    });
}

// 이름 변경 기능 초기화
function initRenaming() {
    // 이름 변경 버튼
    renameBtn.addEventListener('click', showRenameDialog);
    
    // 이름 변경 취소
    cancelRenameBtn.addEventListener('click', () => {
        renameModal.style.display = 'none';
    });
    
    // ESC 키로 이름 변경 취소
    newNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            renameModal.style.display = 'none';
            e.preventDefault(); // 이벤트 기본 동작 방지
        }
    });
    
    // Enter 키로 이름 변경 완료
    newNameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            confirmRenameBtn.click();
        }
    });
    
    // 이름 변경 확인
    confirmRenameBtn.addEventListener('click', () => {
        const newName = newNameInput.value.trim();
        
        if (!newName) {
            alert('새 이름을 입력해주세요.');
        return;
    }
        
        const selectedItem = document.querySelector('.file-item.selected');
        const oldName = selectedItem.getAttribute('data-name');
        const oldPath = currentPath ? `${currentPath}/${oldName}` : oldName;
        // 경로에 한글이 포함된 경우를 위해 인코딩 처리
        const encodedPath = encodeURIComponent(oldPath);
        
        showLoading();
        statusInfo.textContent = '이름 변경 중...';
        
        fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newName: newName })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error('이미 존재하는 이름입니다.');
                }
                throw new Error('이름 변경에 실패했습니다.');
            }
            renameModal.style.display = 'none';
            loadFiles(currentPath); // 파일 목록 새로고침
            statusInfo.textContent = '이름 변경 완료';
        })
        .catch(error => {
            alert(error.message);
            hideLoading();
            statusInfo.textContent = '이름 변경 실패';
        });
    });
}


// 파일 업로드 기능 초기화
function initFileUpload() {
    fileUploadInput.addEventListener('change', (e) => {
        const files = e.target.files;

        if (!files || files.length === 0) return;

        // 파일 크기 제한 확인
        const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB
        let hasLargeFile = false;
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > maxFileSize) {
                alert(`파일 크기가 너무 큽니다: ${files[i].name} (${formatFileSize(files[i].size)})
최대 파일 크기: 10GB`);
                hasLargeFile = true;
                break;
            }
        }

        if (hasLargeFile) {
            e.target.value = ''; // 파일 입력 초기화
            return;
        }

        // 업로드 소스 설정 및 카운터 초기화
        uploadSource = 'button';
        uploadButtonCounter = 0;

        // FileList를 { file: File, relativePath: string } 형태의 배열로 변환
        const filesWithPaths = Array.from(files).map(file => ({
            file: file,
            relativePath: file.name // 버튼 업로드는 상대 경로가 파일명 자체
        }));

        uploadFiles(filesWithPaths, currentPath); // 현재 경로에 업로드

        // 파일 입력 초기화
        e.target.value = '';
    });
}

// 잘라내기/붙여넣기 기능 초기화
function initClipboardOperations() {
    // 잘라내기 버튼
    cutBtn.addEventListener('click', cutSelectedItems);
    
    // 붙여넣기 버튼
    pasteBtn.addEventListener('click', pasteItems);
}

// 삭제 기능 초기화
function initDeletion() {
    deleteBtn.addEventListener('click', deleteSelectedItems);
}

// 검색 기능 초기화
function initSearch() {
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const fileName = item.getAttribute('data-name').toLowerCase();
            if (fileName.includes(query)) {
                item.style.display = '';
                } else {
                item.style.display = 'none';
            }
        });
    });
}

// 선택된 파일 다운로드
function downloadSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 단일 파일 다운로드
    if (selectedItems.size === 1) {
        const itemId = [...selectedItems][0];
        const element = document.querySelector(`.file-item[data-id="${itemId}"]`);
        const isFolder = element.getAttribute('data-is-folder') === 'true';
        
        // 단일 파일 경로 생성
        const filePath = currentPath ? `${currentPath}/${itemId}` : itemId;
        const encodedPath = encodeURIComponent(filePath);
        const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
        
        // 폴더인 경우에도 압축하여 다운로드
        if (isFolder) {
            compressAndDownload([itemId]);
            return;
        }
        
        // 일반 파일은 다운로드 - 새 창에서 열기
        window.open(fileUrl, '_blank');
        
        statusInfo.textContent = `${itemId} 다운로드 중...`;
        setTimeout(() => {
            statusInfo.textContent = `${itemId} 다운로드 완료`;
        }, 1000);
        
        return;
    }
    
    // 여러 항목 선택 시 압축하여 다운로드
    compressAndDownload([...selectedItems]);
}

// 여러 파일/폴더를 압축하여 다운로드
function compressAndDownload(itemList) {
    if (!itemList || itemList.length === 0) return;
    
    showLoading();
    statusInfo.textContent = '압축 패키지 준비 중...';
    
    // 기본 파일명 생성 (현재 폴더명 또는 기본명 + 날짜시간)
    const now = new Date();
    const dateTimeStr = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    
    // 현재 폴더명 또는 기본명으로 압축파일명 생성
    const currentFolderName = currentPath ? currentPath.split('/').pop() : 'files';
    const zipName = `${currentFolderName}_${dateTimeStr}.zip`;
    
    // API 요청 데이터
    const requestData = {
        files: itemList,
        targetPath: '',  // 임시 압축 위치는 루트에 생성
        zipName: zipName
    };
    
    // 압축 API 호출
    fetch(`${API_BASE_URL}/api/compress`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '압축 중 오류가 발생했습니다.');
            });
        }
        return response.json();
    })
    .then(data => {
        // 압축 성공 후 다운로드 시작
        const zipPath = data.zipPath ? `${data.zipPath}/${data.zipFile}` : data.zipFile;
        const encodedZipPath = encodeURIComponent(zipPath);
        const zipUrl = `${API_BASE_URL}/api/files/${encodedZipPath}`;
        
        // 새 창에서 다운로드
        window.open(zipUrl, '_blank');
        
        // 상태 업데이트
        statusInfo.textContent = `${itemList.length}개 항목 압축 다운로드 중...`;
        hideLoading();
        
        // 임시 압축 파일 삭제 (다운로드 시작 후 10초 후)
        setTimeout(() => {
            fetch(`${API_BASE_URL}/api/files/${encodedZipPath}`, {
                method: 'DELETE'
            })
            .then(() => {
                console.log(`임시 압축 파일 삭제됨: ${zipPath}`);
            })
            .catch(err => {
                console.error('임시 압축 파일 삭제 오류:', err);
            });
            
            // 상태 메시지 업데이트
            statusInfo.textContent = `${itemList.length}개 항목 압축 다운로드 완료`;
        }, 10000); // 10초 후 삭제
    })
    .catch(error => {
        // 오류 처리
        console.error('압축 및 다운로드 오류:', error);
        alert(`압축 및 다운로드 중 오류가 발생했습니다: ${error.message}`);
        hideLoading();
        statusInfo.textContent = '다운로드 실패';
    });
}

// 항목 이동
function moveItems(itemIds) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) return;
    
    // 상위 폴더(..)는 제외
    const itemsToMove = itemIds.filter(id => id !== '..');
    
    if (itemsToMove.length === 0) {
        alert('이동할 항목이 없습니다. 상위 폴더는 이동할 수 없습니다.');
        return;
    }
    
    // 클립보드에 추가
    clipboardItems = [];
    itemsToMove.forEach(id => {
        const element = document.querySelector(`.file-item[data-id="${id}"]`);
        if (element) {
            clipboardItems.push({
                name: id,
                isFolder: element.getAttribute('data-is-folder') === 'true',
                originalPath: currentPath
            });
        }
    });
    
    clipboardOperation = 'cut';
    pasteBtn.disabled = false;
}

// 상위 폴더로 이동
function navigateToParentFolder() {
    if (!currentPath) return; // 이미 루트 폴더인 경우
    
    
    // 마지막 슬래시 위치 찾기
    const lastSlashIndex = currentPath.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
        // 슬래시가 없으면 루트 폴더로 이동
        currentPath = '';
             } else {
        // 슬래시가 있으면 상위 경로로 이동
        currentPath = currentPath.substring(0, lastSlashIndex);
    }
    
    // 폴더 이동 히스토리 상태 업데이트
    updateHistoryState(currentPath);
    
    // 파일 목록 새로고침
    loadFiles(currentPath);
    
    // 선택 초기화
    clearSelection();
}

// 브라우저 히스토리 상태 업데이트
function updateHistoryState(path) {
    const state = { path: path };
    const url = new URL(window.location.href);
    url.searchParams.set('path', path);
    
    // 현재 상태 교체
    window.history.pushState(state, '', url);
}

// 브라우저 뒤로가기/앞으로가기 이벤트 처리
function initHistoryNavigation() {
    // 페이지 로드 시 URL에서 경로 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const pathParam = urlParams.get('path');
    
    if (pathParam) {
        currentPath = pathParam;
    }
    
    // 초기 상태 설정
    const initialState = { path: currentPath };
    window.history.replaceState(initialState, '', window.location.href);
    
    // 팝스테이트 이벤트 핸들러
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path !== undefined) {
            currentPath = e.state.path;
            loadFiles(currentPath);
        }
    });
}

// 파일 다운로드 및 실행 함수
function downloadAndOpenFile(fileName) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const encodedPath = encodeURIComponent(filePath);
    const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
    
    // 파일 확장자 확인
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    // 실행 가능 확장자 목록
    const executableTypes = ['exe', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'app', 'vbs', 'jar'];
    
    // 브라우저에서 볼 수 있는 파일 확장자
    const viewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
                          'mp4', 'webm', 'ogg', 'mp3', 'wav', 
                          'pdf', 'txt', 'html', 'htm', 'css', 'js', 'json', 'xml'];
    
    // 실행 가능한 파일인 경우
    if (executableTypes.includes(fileExt)) {
        // 사용자에게 알림
        statusInfo.textContent = `${fileName} 다운로드 중...`;
        
        // 원래 방식으로 복구
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 명시적으로 download 속성 설정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            statusInfo.textContent = `${fileName} 다운로드 완료됨. 파일을 실행하세요.`;
        }, 1000);
    } 
    // 브라우저에서 볼 수 있는 파일인 경우
    else if (viewableTypes.includes(fileExt)) {
        // 직접 보기 모드로 URL 생성 (view=true 쿼리 파라미터 추가)
        const viewUrl = `${API_BASE_URL}/api/files/${encodedPath}?view=true`;
        // 새 창에서 열기
        window.open(viewUrl, '_blank');
        statusInfo.textContent = `${fileName} 파일 열기`;
    } 
    // 그 외 파일은 단순 다운로드
    else {
        // 원래 방식으로 복구
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 명시적으로 download 속성 설정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        statusInfo.textContent = `${fileName} 다운로드 중...`;
        
        setTimeout(() => {
            statusInfo.textContent = `${fileName} 다운로드 완료`;
        }, 1000);
    }
}

// 애플리케이션 초기화
}

// 페이지 로드 시 애플리케이션 초기화

// 화면 클릭 시 파일 선택 해제 리스너 수정
document.addEventListener('click', (event) => {
    // 드래그 직후의 클릭이면 무시하고 플래그 초기화
    if (wasDragging) {
        wasDragging = false;
        return;
    }

    // 클릭된 요소가 파일 아이템 또는 그 하위 요소가 아니고,
    // 파일 작업을 위한 컨텍스트 메뉴 관련 요소도 아닌 경우
    if (!event.target.closest('.file-item') && !event.target.closest('#contextMenu') && !event.target.closest('.action-button')) {
        // 현재 선택된 모든 파일 아이템 가져오기
        const selectedItems = document.querySelectorAll('.file-item.selected');
        // 각 선택된 아이템에서 'selected' 클래스 제거
        selectedItems.forEach(item => {
            item.classList.remove('selected');
        });

    }
});


// 선택한 파일 압축
function compressSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 선택된 파일/폴더 중 첫 번째 항목의 이름 가져오기
    const selectedItemsArray = Array.from(selectedItems);
    const firstItemName = selectedItemsArray[0];
    
    // 파일 크기 확인
    let hasLargeFile = false;
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    
    for (const item of selectedItemsArray) {
        const fileInfo = fileInfoMap.get(item);
        if (fileInfo && fileInfo.type === 'file' && fileInfo.size > MAX_FILE_SIZE) {
            hasLargeFile = true;
            break;
        }
    }
    
    if (hasLargeFile) {
        alert('500MB 이상의 파일이 포함되어 있어 압축할 수 없습니다.');
        return;
    }
    
    // 현재 날짜와 시간을 문자열로 변환
    const now = new Date();
    const dateTimeStr = now.getFullYear() +
                        String(now.getMonth() + 1).padStart(2, '0') +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') +
                        String(now.getMinutes()).padStart(2, '0') +
                        String(now.getSeconds()).padStart(2, '0');
    
    // 기본 압축 파일 이름 설정 (첫 번째 선택 항목 + 날짜시간)
    const defaultZipName = `${firstItemName}_${dateTimeStr}`;
    
    // 압축 파일 이름 입력 받기
    const zipName = prompt('압축 파일 이름을 입력하세요:', defaultZipName);
    if (!zipName) return; // 취소한 경우
    
    showLoading();
    statusInfo.textContent = '압축 중...';
    
    // 압축할 파일 목록 생성
    const filesToCompress = selectedItemsArray;
    
    // API 요청 데이터
    const requestData = {
        files: filesToCompress,
        targetPath: currentPath,
        zipName: zipName
    };
    
    // 압축 API 호출
    fetch(`${API_BASE_URL}/api/compress`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '압축 중 오류가 발생했습니다.');
            });
        }
        return response.json();
    })
    .then(data => {
        // 성공 처리
        statusInfo.textContent = `${filesToCompress.length}개 항목이 ${data.zipFile}로 압축되었습니다.`;
        hideLoading();
        
        // 압축 후 파일 목록 새로고침
        loadFiles(currentPath);
    })
    .catch(error => {
        // 오류 처리
        console.error('압축 오류:', error);
        statusInfo.textContent = `압축 실패: ${error.message}`;
        alert(`압축 실패: ${error.message}`);
        hideLoading();
    });
}


// 파일 또는 폴더를 지정된 대상 폴더로 이동하는 함수
function moveToFolder(itemsToMove, targetFolder, autoMove = false) {
    // 이동 중복 호출 방지 상태 확인
    if (window.isMovingFiles) {
        console.log('이미 파일 이동 작업이 진행 중입니다.');
        return Promise.reject('이미 파일 이동 작업이 진행 중입니다.');
    }
    
    // 이동할 항목이 없으면 무시
    if (!itemsToMove || itemsToMove.length === 0) {
        console.log('이동할 항목이 없습니다.');
        return Promise.reject('이동할 항목이 없습니다.');
    }
    
    // 드롭된 폴더 경로 계산
    let targetPath;
    if (targetFolder.startsWith('/')) {
        targetPath = targetFolder; // 절대 경로
    } else if (currentPath && targetFolder.startsWith(currentPath + '/')) {
        targetPath = targetFolder; // 이미 currentPath 포함된 경우
    } else {
        targetPath = currentPath ? `${currentPath}/${targetFolder}` : targetFolder; // currentPath 기준으로 상대 경로
    }
    
    // 호출 카운터 증가 - 함수 호출 추적
    dragDropMoveCounter++;
    console.log(`[moveToFolder] 파일 이동 함수 호출 횟수: ${dragDropMoveCounter}`);
    statusInfo.textContent = `파일 이동 함수 호출 횟수: ${dragDropMoveCounter}`;
    
    // 이동 중 상태 설정
    window.isMovingFiles = true;
    
    // 이동 전 충돌 항목 확인 (모든 항목에 대해 한 번만 확인)
    const conflictCheckPromises = itemsToMove.map(item => {
        const sourceFullPath = item.startsWith("/") ? item : (currentPath ? `${currentPath}/${item}` : item);
        const fileName = item;
        
        // 소스와 타겟이 같은 경로인지 확인
        if (sourceFullPath === `${targetPath}/${fileName}`) {
            console.log(`[${fileName}] 소스와 타겟이 동일합니다. 무시합니다.`);
            return { item, exists: false, skip: true };
        }
        
        // 파일 존재 여부 확인 과정을 생략하고 항상 존재하지 않는다고 가정
        // 이렇게 하면 404 오류가 콘솔에 표시되지 않음
        // 실제 충돌은 moveItem 함수 내에서 처리됨
        return Promise.resolve({ item, exists: false, skip: false });
    });
    
    return Promise.all(conflictCheckPromises)
        .then(results => {
            // 충돌 항목만 필터링
            const conflictItems = results.filter(result => result.exists && !result.skip);
            const skipItems = results.filter(result => result.skip);
            const nonConflictItems = results.filter(result => !result.exists && !result.skip);
            
            // 로그 정보
            console.log(`충돌 항목: ${conflictItems.length}, 동일 경로 무시: ${skipItems.length}, 비충돌 항목: ${nonConflictItems.length}`);
            
            // 자동 이동 모드일 경우, 또는 충돌이 없는 경우 확인 메시지 없이 진행
            let shouldOverwrite = autoMove;
            
            // 충돌 항목이 있고 자동 이동 모드가 아닌 경우만 확인
            if (conflictItems.length > 0 && !autoMove) {
                const confirmMsg = 
                    conflictItems.length === 1 
                    ? `'${targetFolder}' 폴더에 이미 '${conflictItems[0].item}'이(가) 존재합니다. 덮어쓰시겠습니까?` 
                    : `'${targetFolder}' 폴더에 ${conflictItems.length}개의 항목이 이미 존재합니다. 모두 덮어쓰시겠습니까?`;
                
                shouldOverwrite = confirm(confirmMsg);
                
                // 덮어쓰기 거부시
                if (!shouldOverwrite) {
                    console.log('사용자가 덮어쓰기를 거부했습니다.');
                    
                    // 비충돌 항목만 이동하도록 필터링
                    itemsToMove = nonConflictItems.map(item => item.item);
                    
                    // 이동할 항목이 없으면 작업 중단
                    if (itemsToMove.length === 0) {
                        window.isMovingFiles = false;
                        return Promise.reject('모든 이동 작업이 취소되었습니다.');
                    }
                }
            }
            
            // 로딩 표시
            showLoading();
            statusInfo.textContent = '파일 이동 중...';
            
            // 이동할 최종 항목 목록 (충돌 항목 포함 여부는 사용자 선택에 따름)
            const finalItemsToMove = shouldOverwrite 
                ? [...nonConflictItems, ...conflictItems].map(item => item.item) 
                : nonConflictItems.map(item => item.item);
            
            // 무시할 항목은 이미 제외됨
            
            // 선택된 모든 항목 이동
            const movePromises = finalItemsToMove.map(item => {
                // 기존 로직: const sourceFullPath = currentPath ? `${currentPath}/${item}` : item;
                // 기존 로직: const sourceFullPath = currentPath ? `${currentPath}/${item}` : item;
                // 수정된 로직: 절대 경로인지 확인하여 처리
                let sourceFullPath;
                if (item.startsWith('/')) {
                    sourceFullPath = item; // 절대 경로
                } else if (currentPath && item.startsWith(currentPath + '/')) {
                    sourceFullPath = item; // 이미 currentPath 포함된 경우
                } else {
                    sourceFullPath = currentPath ? `${currentPath}/${item}` : item; // currentPath 기준으로 상대 경로
                }
            
                // 로그 추가: 이동 경로 확인 (이 부분은 유지하거나 필요에 따라 수정)
                console.log(`[moveToFolder] 이동 호출: ${sourceFullPath} -> ${targetPath}`);
            
                return moveItem(sourceFullPath, targetPath, shouldOverwrite);
            });
            
            return Promise.allSettled(movePromises)
                .then(moveResults => {
                    // 결과 분석
                    const fulfilled = moveResults.filter(result => result.status === 'fulfilled').length;
                    const rejected = moveResults.filter(result => result.status === 'rejected').length;
                    
                    // 이동 결과 메시지
                    let resultMessage = `${fulfilled}개 항목을 이동했습니다.`;
                    if (rejected > 0) {
                        resultMessage += ` ${rejected}개 항목 이동 실패.`;
                    }
                    if (skipItems.length > 0) {
                        resultMessage += ` ${skipItems.length}개 항목 동일 경로로 무시됨.`;
                    }
                    
                    // 화면에 결과 표시
                    statusInfo.textContent = resultMessage;
                    
                    // 선택 초기화
                    clearSelection();
                    
                    // 목록 새로고침
                    return loadFiles(currentPath);
                })
                .catch(error => {
                    // 이동 실패
                    statusInfo.textContent = `이동 중 오류가 발생했습니다: ${error}`;
                    console.error('Move error:', error);
                    return Promise.reject(error);
                })
                .finally(() => {
                    // 이동 상태 초기화 및 로딩 숨김
                    window.isMovingFiles = false;
                    hideLoading();
                });
        })
        .catch(error => {
            window.isMovingFiles = false;
            statusInfo.textContent = `이동 준비 중 오류: ${error}`;
            console.error('Move preparation error:', error);
            return Promise.reject(error);
    });
}

// 폴더 잠금 상태 확인
function isPathLocked(path) {
    // 잠금 기능을 사용할 수 없으면 항상 false 반환
    if (!lockFeatureAvailable) {
        return false;
    }
    
    if (!lockedFolders || lockedFolders.length === 0) {
        return false;
    }
    
    // 직접 잠긴 폴더인지만 확인 (하위 폴더는 직접 잠기지 않음)
    // 단, 폴더 조작 시 상위 폴더가 잠겨 있으면 하위 폴더도 접근 불가
    return lockedFolders.includes(path);
}

// 경로 또는 그 상위 폴더가 잠겨 있어 접근이 제한되는지 확인
function isPathAccessRestricted(path) {
    // 잠금 기능을 사용할 수 없으면 항상 false 반환
    if (!lockFeatureAvailable) {
        return false;
    }
    
    if (!lockedFolders || lockedFolders.length === 0) {
        return false;
    }
    
    // 경로 자체가 잠긴 폴더인지 확인 (하위 경로 확인 제거)
    return lockedFolders.includes(path);
}

// 잠금 상태 로드 함수
function loadLockStatus() {
    // 이미 잠금 기능을 사용할 수 없다고 판단되면 바로 빈 배열 반환
    if (!lockFeatureAvailable) {
        console.log('잠금 기능을 사용할 수 없습니다.');
        return Promise.resolve([]);
    }
    
    return fetch(`${API_BASE_URL}/api/lock-status`)
        .then(response => {
            if (!response.ok) {
                // 404 에러인 경우 기능을 사용할 수 없다고 표시
                if (response.status === 404) {
                    lockFeatureAvailable = false;
                    console.log('잠금 기능이 서버에 구현되어 있지 않습니다.');
                }
                // 오류이지만 처리는 계속하기 위해 빈 배열 반환
                return { lockState: [] };
            }
            return response.json();
        })
        .then(data => {
            // data가 null이거나 lockState가 없는 경우 빈 배열로 처리
            if (!data || !data.lockState) {
                lockedFolders = [];
         } else {
                lockedFolders = data.lockState;
            }
            console.log('잠금 폴더 목록:', lockedFolders);
            return lockedFolders;
        })
        .catch(error => {
            // 콘솔 에러 메시지를 한 번만 표시
            if (lockFeatureAvailable) {
                console.error('잠금 상태 조회 오류:', error);
                // 서버가 기능을 지원하지 않으므로 기능 비활성화
                lockFeatureAvailable = false;
            }
            lockedFolders = [];
            return [];
        });
}



// 폴더 잠금 토글 기능
function toggleFolderLock(action = 'lock') {
    // 잠금 기능을 사용할 수 없으면 경고 표시
    if (!lockFeatureAvailable) {
        console.log('폴더 잠금 기능을 사용할 수 없습니다.');
        // 기능이 없으므로 아무 메시지도 표시하지 않고 조용히 무시
        return;
    }
    
    // 선택된 폴더 항목들 확인
    const selectedFolders = [];
    
    // 선택된 항목들 중에서 폴더만 필터링
    selectedItems.forEach(itemName => {
        const element = document.querySelector(`.file-item[data-name="${itemName}"]`);
        if (element && element.getAttribute('data-is-folder') === 'true') {
            const folderPath = currentPath ? `${currentPath}/${itemName}` : itemName;
            
            // 상위 폴더가 잠겨있는지 확인 (잠금 동작인 경우)
            if (action === 'lock' && isPathAccessRestricted(folderPath) && !isPathLocked(folderPath)) {
                statusInfo.textContent = `상위 폴더가 잠겨 있어 '${itemName}' 폴더는 잠글 수 없습니다.`;
                return; // 이 폴더는 건너뜀
            }
            
            selectedFolders.push({
                name: itemName,
                path: folderPath,
                isLocked: isPathLocked(folderPath)
            });
        }
    });
    
    if (selectedFolders.length === 0) {
        // 폴더가 선택되지 않았으면 조용히 리턴
                         return;
                     }
                     
    // 처리할 폴더들을 필터링 (선택된 동작에 따라)
    const foldersToProcess = action === 'lock' 
        ? selectedFolders.filter(folder => !folder.isLocked) // 잠금 동작이면 현재 잠기지 않은 폴더만
        : selectedFolders.filter(folder => folder.isLocked); // 해제 동작이면 현재 잠긴 폴더만
    
    if (foldersToProcess.length === 0) {
        if (action === 'lock') {
            statusInfo.textContent = '선택된 모든 폴더가 이미 잠겨 있습니다.';
        } else {
            statusInfo.textContent = '선택된 모든 폴더가 이미 잠금 해제되어 있습니다.';
        }
        return;
    }
    
    showLoading();
    
    // 모든 폴더의 잠금/해제 작업을 순차적으로 처리
    const processNextFolder = (index) => {
        if (index >= foldersToProcess.length) {
            // 모든 폴더 처리 완료
            loadLockStatus().then(() => {
                loadFiles(currentPath); // 파일 목록 새로고침
                const actionText = action === 'lock' ? '잠금' : '잠금 해제';
                statusInfo.textContent = `${foldersToProcess.length}개 폴더 ${actionText} 완료`;
                hideLoading();
            });
            return;
        }
        
        const folder = foldersToProcess[index];
        const encodedPath = encodeURIComponent(folder.path);
        
        fetch(`${API_BASE_URL}/api/lock/${encodedPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: action })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`'${folder.name}' 폴더 ${action === 'lock' ? '잠금' : '잠금 해제'} 처리 실패`);
            }
            return response.json();
        })
        .then(data => {
            // 서버에서 건너뛴 경우 처리
            if (data.status === 'skipped') {
                statusInfo.textContent = data.message;
            }
            // 다음 폴더 처리
            processNextFolder(index + 1);
        })
        .catch(error => {
            alert(`오류 발생: ${error.message}`);
            hideLoading();
            loadFiles(currentPath);
        });
    };
    
    // 첫 번째 폴더부터 처리 시작
    processNextFolder(0);
}

// 파일 항목 초기화 - 각 파일/폴더에 이벤트 연결
function initFileItem(fileItem) {
    const fileName = fileItem.getAttribute('data-name');
    
    // 기존 이벤트 리스너 제거
    const newFileItem = fileItem.cloneNode(true);
    if (fileItem.parentNode) {
        fileItem.parentNode.replaceChild(newFileItem, fileItem);
        fileItem = newFileItem;
    }
    
    // 더블클릭 이벤트를 파일 항목에 직접 연결
    fileItem.addEventListener('dblclick', function(e) {
        // 이벤트 전파 중지
        e.preventDefault();
        e.stopPropagation();
        
        // 다른 파일 항목으로의 더블클릭 중복 처리 방지
        if (!window.doubleClickEnabled) {
            console.log('더블클릭 처리 무시: 이미 처리 중');
            return;
        }
        
        try {
            // 요소 검증 추가 - 현재 마우스 위치에 있는 파일 항목이 맞는지 확인
            const elementAtPoint = document.elementFromPoint(window.mouseX || e.clientX, window.mouseY || e.clientY);
            
            // elementAtPoint가 유효하고, closest 메서드가 있는지 확인
            if (elementAtPoint && typeof elementAtPoint.closest === 'function') {
                const targetFileItem = elementAtPoint.closest('.file-item, .file-item-grid');
                
                // 실제 마우스 위치의 항목과 이벤트 대상이 다른 경우
                if (targetFileItem && targetFileItem !== fileItem) {
                    console.log('마우스 위치와 이벤트 대상 불일치, 실제 대상으로 재지정');
                    // 실제 마우스 위치의 대상으로 이벤트 처리
                    handleFileDblClick(e, targetFileItem);
                    return;
                }
            }
        } catch (error) {
            console.error('요소 검증 중 오류 발생:', error);
            // 오류가 발생해도 계속 진행
        }
        
        // 이벤트 처리 위임
        handleFileDblClick(e, fileItem);
    }, true);
    
    // 컨텍스트 메뉴 (우클릭) 이벤트 연결
    fileItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, fileItem);
    });
    
    // 클릭 이벤트 연결
    fileItem.addEventListener('click', (e) => {
        // 우클릭은 여기서 처리하지 않음 (contextmenu 이벤트에서 처리)
        if (e.button !== 0) return;
        
        // 이름 변경 중이면 무시
        if (fileItem.classList.contains('renaming')) return;
        
        // 클릭 이벤트 처리 위임
        handleFileClick(e, fileItem);
        
        // 이벤트 전파 중지 (드래그 선택 이벤트와 충돌 방지)
        e.stopPropagation();
    });
    
    // 파일 항목 내의 각 열(이름, 크기, 수정일)도 클릭 가능하게 설정
    const columns = fileItem.querySelectorAll('.file-name, .file-size, .file-date');
    columns.forEach(column => {
        column.addEventListener('click', (e) => {
            // 이벤트 버블링 방지
            e.stopPropagation();
            
            // 부모 항목에 대한 클릭 처리 위임
            handleFileClick(e, fileItem);
        });
    });
    
    // 드래그 시작 처리를 위한 mousedown 이벤트 유지
    fileItem.addEventListener('mousedown', (e) => {
        // 우클릭은 여기서 처리하지 않음
        if (e.button !== 0) return;
        
        // 상위 폴더는 드래그되지 않도록
        if (fileItem.getAttribute('data-parent-dir') === 'true') {
            return;
        }
        
        // 이름 변경 중이면 무시
        if (fileItem.classList.contains('renaming')) return;
        
        // 파일 아이템 드래그 가능하도록 설정
        fileItem.setAttribute('draggable', 'true');
        
        // 선택된 항목을 클릭한 경우 선택 상태 유지 (드래그 시작 가능)
        if (fileItem.classList.contains('selected')) {
            // mousedown 이벤트의 기본 동작을 멈추지 않음 (drag 이벤트 발생 허용)
            // 대신 e.stopPropagation()만 호출하여 document의 mousedown 핸들러가 호출되지 않도록 함
            e.stopPropagation();
            return;
        }
        
        // 선택되지 않은 항목을 클릭한 경우 새로 선택 (mousedown에서 즉시 선택)
        if (!e.ctrlKey && !e.shiftKey) {
            clearSelection();
            selectItem(fileItem);
            // 드래그를 허용하기 위해 기본 동작은 막지 않음
            e.stopPropagation();
        }
    });
    
    // 드래그 이벤트 연결
    fileItem.addEventListener('dragstart', (e) => {
        // 상위 폴더는 드래그되지 않도록
        if (fileItem.getAttribute('data-parent-dir') === 'true') {
            e.preventDefault();
            return;
        }
        
        // 선택된 항목이 아니면 드래그 취소 (수정: 드래그 시작 시점에 선택)
        if (!fileItem.classList.contains('selected')) {
            // 선택되지 않은 항목은 먼저 선택
            clearSelection();
            selectItem(fileItem);
        }
        
        try {
            // 선택된 항목들의 전체 경로 생성
            const draggedItems = Array.from(selectedItems).map(itemName => {
                // 전체 경로 생성 (파일 시스템 구조에 맞게 경로 생성)
                return currentPath ? `${currentPath}/${itemName}` : itemName;
            });
            
            console.log('드래그 시작 - 항목:', draggedItems);
            
            // 1. 텍스트 데이터로 경로 정보 저장
            // 여러 항목은 줄바꿈으로 구분된 문자열로 저장
            e.dataTransfer.setData('text/plain', draggedItems.join('\n'));
            
            // 2. 내부 드래그 마커 설정 (호환성 유지)
            e.dataTransfer.setData('application/x-internal-drag', 'true');
            
            // 3. 드래그 시각 효과 설정
            e.dataTransfer.effectAllowed = 'move';
            
            // 4. 추가 메타데이터 저장 - 경로 기반 구분을 위한 정보
            const metaData = {
                source: 'internal',
                type: 'webdav-path',
                host: window.location.hostname,
                items: draggedItems
            };
            e.dataTransfer.setData('application/json', JSON.stringify(metaData));
            
            // 글로벌 드래그 상태 추적 시작
            if (typeof window.startFileDrag === 'function') {
                window.startFileDrag(selectedItems);
            }
            
            // 드래그 중 스타일 적용
            setTimeout(() => {
                document.querySelectorAll('.file-item.selected, .file-item-grid.selected').forEach(item => {
                    item.classList.add('dragging');
                });
            }, 0);
            
            console.log('[File Drag Start] 경로 기반 내부 드래그 설정 완료', draggedItems);
            console.log('[File Drag Start] dataTransfer types:', Array.from(e.dataTransfer.types));

        } catch (error) {
            console.error('드래그 설정 중 오류 발생:', error);
            // 오류 발생 시 기본 정보만이라도 설정 (단일 파일명)
            try {
                const singleItemPath = currentPath ? `${currentPath}/${fileItem.getAttribute('data-name')}` : fileItem.getAttribute('data-name');
                e.dataTransfer.setData('text/plain', singleItemPath);
                e.dataTransfer.setData('application/x-internal-drag', 'true');
            } catch (innerError) {
                console.error('기본 드래그 설정도 실패:', innerError);
            }
        }
    });
    
    // 드래그 종료 이벤트
    fileItem.addEventListener('dragend', (e) => {
        console.log('파일 항목 dragend 이벤트 발생');
        
        // 보편적인 드래그 상태 정리 함수 호출
        handleDragEnd();
        
        // 이벤트 캡처링이 진행되도록 중단하지 않음
    });
}

// 파일/폴더 목록 화면에 표시
function displayFiles(files, parentPath = '') {
    const fileList = document.getElementById('fileList');
    const fileGrid = document.getElementById('fileGrid');
    
    // 목록 초기화
    fileList.innerHTML = '';
    fileGrid.innerHTML = '';
    
    // 필터링된 파일 목록 가져오기
    const filteredFiles = getFilteredFiles(files);
    sortFiles(filteredFiles);
    
    // 상위 폴더로 이동 항목 추가 (루트가 아닌 경우)
    if (currentPath) {
        // 상위 폴더 경로 계산
        const parentDir = getParentPath(currentPath);
        
        // 목록 뷰에 상위 폴더 추가
        const parentItem = document.createElement('div');
        parentItem.className = 'file-item parent-dir';
        parentItem.setAttribute('data-name', '..');
        parentItem.setAttribute('data-is-folder', 'true');
        parentItem.setAttribute('data-parent-dir', 'true'); // 상위 폴더 표시
        parentItem.setAttribute('data-id', '..');
        parentItem.innerHTML = `
            <div class="file-icon"><i class="fas fa-arrow-up"></i></div>
            <div class="file-name">..</div>
            <div class="file-size"></div>
            <div class="file-date"></div>
        `;
        fileList.appendChild(parentItem);
        
        // 그리드 뷰에 상위 폴더 추가
        const parentItemGrid = document.createElement('div');
        parentItemGrid.className = 'file-item-grid parent-dir';
        parentItemGrid.setAttribute('data-name', '..');
        parentItemGrid.setAttribute('data-is-folder', 'true');
        parentItemGrid.setAttribute('data-parent-dir', 'true'); // 상위 폴더 표시
        parentItemGrid.innerHTML = `
            <div class="file-icon"><i class="fas fa-arrow-up"></i></div>
            <div class="file-name">..</div>
        `;
        fileGrid.appendChild(parentItemGrid);
        
        // 초기화 함수 호출 (직접 이벤트를 연결하지 않고 initFileItem을 통해서만 처리)
        initFileItem(parentItem);
        initFileItem(parentItemGrid);
    }
    
    // 각 파일/폴더 항목 생성
    filteredFiles.forEach(file => {
        // 파일 정보 맵에 저장 (나중에 참조하기 위함)
        fileInfoMap.set(file.name, file);
        
        // 파일/폴더 아이콘 결정
        const icon = getFileIcon(file);
        
        // 목록 뷰용 항목 생성
        const listItem = document.createElement('div');
        listItem.className = 'file-item';
        listItem.setAttribute('data-name', file.name);
        listItem.setAttribute('data-is-folder', file.isFolder.toString());
        listItem.setAttribute('data-id', file.name);
        listItem.setAttribute('draggable', 'true');
        listItem.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-name">${file.name}</div>
            <div class="file-size">${file.isFolder ? '' : formatFileSize(file.size)}</div>
            <div class="file-date">${formatDate(file.modifiedTime)}</div>
        `;
        fileList.appendChild(listItem);
        
        // 그리드 뷰용 항목 생성
        const gridItem = document.createElement('div');
        gridItem.className = 'file-item-grid';
        gridItem.setAttribute('data-name', file.name);
        gridItem.setAttribute('data-is-folder', file.isFolder.toString());
        gridItem.setAttribute('draggable', 'true');
        gridItem.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-name">${file.name}</div>
        `;
        fileGrid.appendChild(gridItem);
        
        // 각 항목 초기화 (이벤트 연결)
        initFileItem(listItem);
        initFileItem(gridItem);
    });
    
    // 선택 가능한 항목으로 만들기
    const fileItems = document.querySelectorAll('.file-item, .file-item-grid');
    
    // 현재 폴더에 있는 파일 개수 표시
    updateFileCount(filteredFiles.length);
    
    // 버튼 상태 업데이트
    updateButtonStates();
}

// 마우스 위치 추적 기능 추가
document.addEventListener('mousemove', function(e) {
    // 현재 마우스 위치 저장
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;
    
    // e.target이 Element인지 확인 (Node.ELEMENT_NODE = 1)
    if (e.target && e.target.nodeType === 1 && typeof e.target.closest === 'function') {
        // 마우스 이벤트 대상 요소에 호버 클래스 추가
        const fileItem = e.target.closest('.file-item, .file-item-grid');
        if (fileItem) {
            // 기존 호버 클래스 제거
            document.querySelectorAll('.file-item.hover, .file-item-grid.hover').forEach(item => {
                item.classList.remove('hover');
            });
            
            // 현재 요소에 호버 클래스 추가
            fileItem.classList.add('hover');
        }
    }
});

// 토스트 메시지 표시 함수
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // 토스트 컨테이너 찾기 또는 생성
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // 토스트 추가
    toastContainer.appendChild(toast);
    
    // 애니메이션 효과 (나타남)
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 3초 후 사라짐
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300); // 페이드아웃 시간
    }, 3000);
}

// 드롭존 초기화 및 이벤트 설정
function initDropZone() {
    // 전역 변수로 등록된 리스너가 있는지 체크
    window.dropZoneInitialized = window.dropZoneInitialized || false;
    
    // 이미 초기화 된 경우 중복 등록 방지
    if (window.dropZoneInitialized) {
        console.log('드롭존 이미 초기화됨, 중복 등록 방지');
        return;
    }
    
    // 기본 동작 방지 함수 (드래그 앤 드롭 이벤트에서 사용)
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // 드롭된 위치에서 폴더 항목 찾기
    function findDropTarget(e) {
        // 드롭된 요소와 그 부모 요소들을 확인
        let target = e.target;
        while (target && target !== document.body) {
            // 파일 항목인지 확인
            const fileItem = target.closest('.file-item');
            if (fileItem) {
                // 폴더인 경우에만 타겟으로 반환
                if (fileItem.getAttribute('data-is-folder') === 'true') {
                    // 상위 폴더(..)는 제외
                    if (fileItem.getAttribute('data-parent-dir') !== 'true') {
                        return fileItem;
                    }
                }
                break; // 파일이면 반복 중단
            }
            target = target.parentElement;
        }
        return null; // 폴더를 찾지 못함
    }
    
    // 이전에 등록된 이벤트 핸들러 제거 (중복 방지)
    dropZone.removeEventListener('dragover', handleDragOver);
    dropZone.removeEventListener('dragleave', handleDragLeave);
    dropZone.removeEventListener('drop', handleDrop);
    fileView.removeEventListener('dragover', handleDragOver);
    fileView.removeEventListener('dragleave', handleDragLeave);
    fileView.removeEventListener('drop', handleDrop);
    fileView.removeEventListener('drop', handleFileDrop); // 추가: 파일뷰의 파일드롭 핸들러도 제거
    document.body.removeEventListener('dragover', preventDefaults);
    document.body.removeEventListener('drop', preventDefaults);
    
    // 이벤트 핸들러 함수 정의
    function handleDragOver(e) {
        preventDefaults(e);
        if (!e.currentTarget.classList.contains('dragging')) {
            e.currentTarget.classList.add('dragging');
        }
        dropZone.style.display = 'flex';
    }
    
    function handleDragLeave(e) {
        preventDefaults(e);
        if (e.currentTarget.contains(e.relatedTarget)) return;
        e.currentTarget.classList.remove('dragging');
        if (e.currentTarget === dropZone) {
            setTimeout(() => {
                dropZone.style.display = 'none';
            }, 100);
        }
    }
    
    function handleDrop(e) {
        preventDefaults(e);
        e.currentTarget.classList.remove('dragging');
        dropZone.style.display = 'none';
        
        // 내부/외부 파일 판단
        const { isExternalDrop, isInternalDrop, draggedPaths, reason } = determineDropType(e);
        
        // 최종 판단 로그 출력
        console.log(`[initDropZone - 드롭 처리] ${isInternalDrop ? '내부' : '외부'} 파일, 이유: ${reason}`);
        
        // 폴더 항목에 드롭된 경우 해당 폴더를 타겟으로 지정
        const folderItem = findDropTarget(e);
        
        // 외부 파일 처리
        if (isExternalDrop) {
            console.log('[initDropZone] 외부 파일 드롭 처리');
        if (folderItem) {
            handleExternalFileDrop(e, folderItem);
        } else {
            handleExternalFileDrop(e);
            }
        }
        // 내부 파일 이동 처리
        else if (isInternalDrop && draggedPaths.length > 0) {
            console.log('[initDropZone] 내부 파일 이동 처리:', draggedPaths);
            
            // 폴더 항목에 드롭된 경우 해당 폴더를 타겟으로 처리
            if (folderItem) {
                handleInternalFileDrop(draggedPaths, folderItem);
            } else {
                // 현재 디렉토리에 드롭된 경우
                handleInternalFileDrop(draggedPaths, { path: currentPath });
            }
        }
        // 판단 불가능한 경우
        else {
            console.log('[initDropZone] 처리할 수 없는 드롭 데이터');
            showToast('처리할 수 없는 드롭 데이터입니다.', 'error');
        }
    }
    
    // 새 이벤트 핸들러 등록
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileView.addEventListener('dragover', handleDragOver);
    fileView.addEventListener('dragleave', handleDragLeave);
    fileView.addEventListener('drop', handleDrop);
    document.body.addEventListener('dragover', preventDefaults);
    document.body.addEventListener('drop', preventDefaults);
    
    // 페이지 로드 시 드래그 클래스 초기화
    dropZone.classList.remove('dragging');
    fileView.classList.remove('dragging');
    dropZone.style.display = 'none';
    
    console.log('드롭존 초기화 완료, 중복 등록 방지 플래그 설정');
    window.dropZoneInitialized = true;  // 초기화 완료 플래그 설정
}



// 드래그된 데이터가 내부 파일인지 외부 파일인지 판단하는 공통 함수
function determineDropType(e) {
    // 판단 이유를 저장하는 변수
    let reason = '기본값: 내부';
    
    // 반환할 결과 객체 - 기본값을 내부로 설정
    const result = {
        isExternalDrop: false,
        isInternalDrop: true,  // 기본값을 내부로 설정
        draggedPaths: [],
        reason: reason
    };
    
    // 결정적인 외부 파일 증거: File 객체가 존재하면 무조건 외부 파일로 판단
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        result.isExternalDrop = true;
        result.isInternalDrop = false;
        result.reason = `외부 파일 객체 발견: ${e.dataTransfer.files.length}개`;
        console.log(`[내외부 판단] 결과: 외부, 이유: ${result.reason}`);
        return result;
    }
    
    // 데이터 유형 확인
    const dataTypes = Array.from(e.dataTransfer.types || []);
    console.log('데이터 유형:', dataTypes);
    
    // 내부 드래그 마커가 있으면 확실한 내부 파일
    if (dataTypes.includes('application/x-internal-drag')) {
        result.isInternalDrop = true;
        result.reason = '내부 드래그 마커(application/x-internal-drag) 발견';
        console.log(`[내외부 판단] 결과: 내부, 이유: ${result.reason}`);
    }
    
    // 텍스트 데이터에서 경로 정보 추출
    if (dataTypes.includes('text/plain')) {
        const textData = e.dataTransfer.getData('text/plain');
        if (textData) {
            const paths = textData.split('\n').filter(path => path.trim());
            result.draggedPaths = paths;
            
            // 경로 패턴 분석으로 내부/외부 판단
            const externalPaths = paths.filter(path => 
                path.includes('://') ||    // URL 형식 (http://, file://, etc.)
                path.match(/^[a-zA-Z]:[\\\/]/) || // Windows 경로 (C:\, D:\, etc.)
                path.includes(':\\') ||
                path.includes(':/') ||
                path.includes('\\\\')      // UNC 경로 (\\server\share)
            );
            
            // 명확한 외부 경로 패턴이 있으면 외부로 판단
            if (externalPaths.length > 0) {
                result.isExternalDrop = true;
                result.isInternalDrop = false;
                result.reason = `외부 경로 패턴 발견: ${externalPaths.join(', ')}`;
                console.log(`[내외부 판단] 결과: 외부, 이유: ${result.reason}`);
            } else {
                // 내부 경로로 판단되고 경로가 채워짐
                result.reason = `내부 경로 패턴 확인됨: ${paths.join(', ')}`;
                console.log(`[내외부 판단] 결과: 내부, 이유: ${result.reason}`);
            }
        }
    }
    
    // JSON 데이터 확인
    if (dataTypes.includes('application/json')) {
        try {
            const jsonData = JSON.parse(e.dataTransfer.getData('application/json'));
            if (jsonData.source === 'internal' && Array.isArray(jsonData.items) && jsonData.items.length > 0) {
                // JSON에 내부 파일 정보가 있고 draggedPaths가 아직 채워지지 않았으면 채움
                if (result.draggedPaths.length === 0) {
                    result.draggedPaths = jsonData.items;
                }
                result.isInternalDrop = true;
                result.isExternalDrop = false;
                result.reason = `JSON 메타데이터에서 내부 소스 확인: ${jsonData.source}`;
                console.log(`[내외부 판단] 결과: 내부, 이유: ${result.reason}`);
            }
        } catch (error) {
            console.error('JSON 데이터 파싱 오류:', error);
        }
    }
    
    // 경로가 비어있고 내부 드롭인 경우, 선택된 항목 사용
    if (result.isInternalDrop && result.draggedPaths.length === 0) {
        result.draggedPaths = Array.from(selectedItems).map(name => 
            currentPath ? `${currentPath}/${name}` : name);
        result.reason = `선택된 항목에서 경로 추출: ${result.draggedPaths.join(', ')}`;
        console.log(`[내외부 판단] 결과: 내부, 이유: ${result.reason}`);
    }
    
    // 외부 파일이 있으면 내부 드롭을 덮어씀 (외부가 우선)
    if (result.isExternalDrop) {
        result.isInternalDrop = false;
    }
    
    // 최종 판단 로그
    console.log(`[내외부 판단] 최종 결과: ${result.isInternalDrop ? '내부' : '외부'}, 이유: ${result.reason}`);
    
    return result;
}

// 파일/폴더가 드롭되었을 때 호출되는 통합 함수
function handleFileDrop(e, targetFolderItem = null) {
    preventDefaults(e);
    
    // 드래그 상태 초기화
    window.draggingInProgress = false;
    
    // 드롭존 비활성화
    dropZone.classList.remove('active');

    // targetFolderItem이 없으면 드롭된 위치에서 찾음
    if (!targetFolderItem) {
        targetFolderItem = e.target.closest('.file-item');
    }
    
    // 타겟 폴더 정보 로깅
    if (targetFolderItem) {
        const targetName = targetFolderItem.getAttribute('data-name');
        const targetPath = targetFolderItem.getAttribute('data-path') || currentPath;
        console.log(`폴더에 파일 드롭됨 - 대상: ${targetName}, 경로: ${targetPath}`);
        
        // 상위 디렉토리로 이동 처리는 무시
        if (targetName === '..' || targetFolderItem.hasAttribute('data-parent-dir')) {
            console.log('상위 디렉토리로의 이동은 처리하지 않음');
            return;
        }
        
        // 드래그 오버 스타일 제거
        targetFolderItem.classList.remove('drag-over');
    } else {
        console.log('빈 영역에 파일 드롭됨 - 현재 경로에 처리');
    }

    // 내부/외부 파일 판단
    const { isExternalDrop, isInternalDrop, draggedPaths, reason } = determineDropType(e);
    
    // 최종 판단 로그 출력
    console.log(`파일 드롭 처리: ${isInternalDrop ? '내부' : '외부'} 파일, 이유: ${reason}`);
    
    // 최종 판단: 외부 파일이 있으면 외부 드롭으로 처리 (우선순위)
    if (isExternalDrop) {
        console.log('외부 파일 드롭으로 최종 판단');
        
        // 폴더가 아닌 항목 또는 빈 공간에 드롭된 경우 현재 경로에 업로드
        if (!targetFolderItem || targetFolderItem.getAttribute('data-is-folder') !== 'true') {
            console.log('현재 디렉토리에 외부 파일 업로드');
            handleExternalFileDrop(e); // 현재 경로에 업로드
        } else {
            // 폴더 항목에 드롭된 경우 해당 폴더를 타겟으로 지정
            console.log(`'${targetFolderItem.getAttribute('data-name')}' 폴더에 외부 파일 업로드`);
            handleExternalFileDrop(e, targetFolderItem);
        }
    } 
    // 내부 파일 이동 처리
    else if (isInternalDrop && draggedPaths.length > 0) {
        console.log('내부 파일 이동으로 최종 판단');
        
        // 자기 자신에게 드롭하거나 선택된 항목에 드롭하는 경우 방지
        if (targetFolderItem && targetFolderItem.classList.contains('selected')) {
            console.log('선택된 항목에는 드롭할 수 없음');
            return;
        }
        
        // 타겟이 폴더인 경우에만 이동 처리
        if (!targetFolderItem || targetFolderItem.getAttribute('data-is-folder') === 'true') {
            // 내부 파일 이동 처리 (경로 배열과 타겟 폴더 정보 전달)
            handleInternalFileDrop(draggedPaths, targetFolderItem);
        } else {
            console.log('파일에 드롭됨: 폴더가 아니므로 이동할 수 없습니다.');
        }
    } 
    // 처리할 수 없는 드롭
    else {
        console.log('처리할 수 없는 드롭 형식 또는 데이터 없음');
        showToast('처리할 수 없는 드롭 데이터입니다.', 'error');
    }
}