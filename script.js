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
        const scrollDiff = currentScrollTop - initialScrollTop;
        
        // 선택 영역의 절대 위치 계산 (컨테이너 내부 좌표)
        const selectLeft = Math.min(currentClientX, startClientX) - rect.left;
        const selectRight = Math.max(currentClientX, startClientX) - rect.left;
        
        // 스크롤 방향에 관계없이 선택 영역의 시작과 끝 좌표 계산을 수정
        // 시작 위치의 Y 좌표를 스크롤 시작 위치 기준으로 계산
        const startY_abs = startClientY - rect.top + initialScrollTop;
        // 현재 위치의 Y 좌표를 현재 스크롤 위치 기준으로 계산
        const currentY_abs = currentClientY - rect.top + currentScrollTop;
        
        // 최종 상단/하단 좌표 계산
        const selectTop = Math.min(startY_abs, currentY_abs);
        const selectBottom = Math.max(startY_abs, currentY_abs);
        
        // 목록 상단/하단 자동 스크롤
        const buffer = 50; // 자동 스크롤 감지 영역 (픽셀)
        
        // 파일 리스트의 영역 내에 있을 때만 자동 스크롤 처리
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
            if (e.clientY < rect.top + buffer && e.clientY >= rect.top) {
                // 상단으로 스크롤
                fileList.scrollTop -= 10;
            } else if (e.clientY > rect.bottom - buffer && e.clientY <= rect.bottom) {
                // 하단으로 스크롤
                fileList.scrollTop += 10;
            }
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
            const itemLeft = itemRect.left - rect.left;
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
            const itemLeft = itemRect.left - rect.left;
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
            
            // 선택 상태 업데이트 - 그리드 뷰용
            if (overlap) {
                if (!item.classList.contains('selected')) {
                    item.classList.add('selected');
                    // 목록 뷰의 동일 항목도 선택
                    const fileName = item.getAttribute('data-name');
                    selectedItems.add(fileName);
                    const listItem = document.querySelector(`.file-item[data-name="${fileName}"]`);
                    if (listItem) listItem.classList.add('selected');
                }
            } else if (!e.ctrlKey) {
                if (item.classList.contains('selected')) {
                    item.classList.remove('selected');
                    // 목록 뷰의 동일 항목도 선택 해제
                    const fileName = item.getAttribute('data-name');
                    selectedItems.delete(fileName);
                    const listItem = document.querySelector(`.file-item[data-name="${fileName}"]`);
                    if (listItem) listItem.classList.remove('selected');
                }
            }
        });
        
        updateButtonStates();
    });
    
    // 마우스 업 이벤트
    document.addEventListener('mouseup', (e) => {
        // 선택된 항목에서 시작된 경우 처리하지 않음
        if (window.dragSelectState.startedOnSelectedItem) {
            window.dragSelectState.startedOnSelectedItem = false;
            // 선택된 항목에서 드래그가 끝났을 때 모든 dragging 클래스 제거
            document.querySelectorAll('.file-item.dragging, .file-item-grid.dragging').forEach(item => {
                item.classList.remove('dragging');
            });
            return;
        }
        
        if (!window.dragSelectState.isSelecting) return;
        
        const selectionBox = document.getElementById('selectionBox');
        
        window.dragSelectState.isSelecting = false;
        
        // 선택 박스 숨기기
        selectionBox.style.display = 'none';
        
        // 드래그가 거의 없었을 경우, 클릭한 요소가 파일 항목이 아니라면 모든 선택을 해제
        if (!window.dragSelectState.dragStarted) {
            // 파일 항목 위에서 시작하지 않았고, 다른 상호작용 요소(버튼 등)도 아닌 경우에만 선택 해제
            if (!window.dragSelectState.startedOnFileItem && !e.target.closest('button, input, select, a, .modal, .dropdown-menu')) {
                clearSelection();
                updateButtonStates();
            }
        }
        
        window.dragSelectState.dragStarted = false;
        window.dragSelectState.startedOnFileItem = false;
        originalTarget = null;
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
            console.log('clearDragState: 드래그 선택 박스 상태 초기화');
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
    }, true); // 캡처 단계에서 처리하여 다른 이벤트보다 먼저 실행될 가능성 높임
    
    // dragend 이벤트: 드롭이 성공하거나 취소될 때 발생
    document.addEventListener('dragend', (e) => {
        console.log('dragend 이벤트 감지: 드래그 상태 정리 시도');
        // dragend 발생 시 무조건 정리 시도
        window.clearDragState();
    }, true); // 캡처 단계에서 처리
    
    // 페이지 가시성 변경 시 정리 (안전 장치)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && window.isDraggingActive) {
            console.log('페이지 숨김 감지: 드래그 상태 정리 시도');
            window.clearDragState();
        }
    });
    
    // MutationObserver는 복잡성을 증가시키고 다른 문제 유발 가능성 있어 제거
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
    
    // 더블클릭 플래그 제거
    
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
            
            // 더블클릭 활성화 타이머 제거
        })
        .catch(error => {
            console.error('Error:', error);
            statusInfo.textContent = `오류: ${error.message}`;
            hideLoading();
            
            // 오류 발생 시 더블클릭 플래그 관련 로직 제거
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
            filesContainer.className = 'files-container';
            fileView.appendChild(filesContainer);
            
            // 파일 정렬
            const sortedFiles = [...files].sort((a, b) => {
                // 폴더 우선 정렬
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                
                // 선택된 필드로 정렬
                if (sortField === 'name') {
                    return sortDirection === 'asc' 
                        ? a.name.localeCompare(b.name) 
                        : b.name.localeCompare(a.name);
                } else if (sortField === 'size') {
                    return sortDirection === 'asc' 
                        ? a.size - b.size 
                        : b.size - a.size;
                } else if (sortField === 'date') {
                    return sortDirection === 'asc' 
                        ? new Date(a.modifiedTime) - new Date(b.modifiedTime) 
                        : new Date(b.modifiedTime) - new Date(a.modifiedTime);
                }
                
                return 0;
            });
            
            // 숨김 파일 제외 (점으로 시작하는 파일)
            const visibleFiles = sortedFiles.filter(file => !file.name.startsWith('.'));
            
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
                // 잠금 상태 디버그 로깅
                console.log('현재 잠금 폴더 목록:', lockedFolders);
                
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
                    
                    // 잠금 상태 확인 및 표시
                    const isLocked = isPathLocked(filePath);
                    console.log(`파일/폴더: ${filePath}, 잠금 상태: ${isLocked}`);
                    
                    if (file.isFolder && isLocked) {
                        fileItem.classList.add('locked-folder');
                    }
                    
                    // 파일 아이콘 및 미리보기 설정
                    const fileIcon = document.createElement('div');
                    fileIcon.className = 'file-icon';
                    
                    if (file.isFolder) {
                        fileIcon.innerHTML = '<i class="fas fa-folder"></i>';
                    } else {
                        const fileExt = file.name.split('.').pop().toLowerCase();
                        // 아이콘 선택
                        switch (fileExt) {
                            case 'pdf': fileIcon.innerHTML = '<i class="fas fa-file-pdf"></i>'; break;
                            case 'doc': case 'docx': fileIcon.innerHTML = '<i class="fas fa-file-word"></i>'; break;
                            case 'xls': case 'xlsx': fileIcon.innerHTML = '<i class="fas fa-file-excel"></i>'; break;
                            case 'ppt': case 'pptx': fileIcon.innerHTML = '<i class="fas fa-file-powerpoint"></i>'; break;
                            case 'zip': case 'rar': case 'tar': case 'gz': fileIcon.innerHTML = '<i class="fas fa-file-archive"></i>'; break;
                            case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': 
                                fileIcon.innerHTML = '<i class="fas fa-file-image"></i>'; break;
                            case 'mp3': case 'wav': case 'ogg': fileIcon.innerHTML = '<i class="fas fa-file-audio"></i>'; break;
                            case 'mp4': case 'avi': case 'mov': case 'wmv': fileIcon.innerHTML = '<i class="fas fa-file-video"></i>'; break;
                            case 'txt': case 'rtf': fileIcon.innerHTML = '<i class="fas fa-file-alt"></i>'; break;
                            case 'html': case 'htm': case 'css': case 'js': fileIcon.innerHTML = '<i class="fas fa-file-code"></i>'; break;
                            case 'exe': case 'msi': fileIcon.innerHTML = '<i class="fas fa-cog"></i>'; break;
                            default: fileIcon.innerHTML = '<i class="fas fa-file"></i>';
                        }
                    }
                    
                    // 파일 이름
                    const fileName = document.createElement('div');
                    fileName.className = 'file-name';
                    fileName.innerText = file.name;
                    
                    // 이름 변경 입력 필드
                    const renameInput = document.createElement('input');
                    renameInput.type = 'text';
                    renameInput.className = 'rename-input';
                    renameInput.value = file.name;
                    
                    // 파일 세부 정보
                    const fileDetails = document.createElement('div');
                    fileDetails.className = 'file-details';
                    
                    // 파일 크기
                    const fileSize = document.createElement('div');
                    fileSize.className = 'file-size';
                    fileSize.innerText = file.isFolder ? '--' : formatFileSize(file.size);
                    
                    // 파일 날짜
                    const fileDate = document.createElement('div');
                    fileDate.className = 'file-date';
                    fileDate.innerText = formatDate(file.modifiedTime);
                    
                    // 세부 정보에 추가
                    fileDetails.appendChild(fileSize);
                    fileDetails.appendChild(fileDate);
                    
                    // 파일 항목에 추가
                    fileItem.appendChild(fileIcon);
                    fileItem.appendChild(fileName);
                    fileItem.appendChild(renameInput);
                    fileItem.appendChild(fileDetails);
                    
                    // 잠긴 폴더에 잠금 아이콘 추가
                    if (file.isFolder && isLocked) {
                        const lockIcon = document.createElement('div');
                        lockIcon.className = 'lock-icon';
                        lockIcon.innerHTML = '<i class="fas fa-lock"></i>';
                        fileItem.appendChild(lockIcon);
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
    
    // 실제 클릭한 요소가 파일 아이템이 아니면 파일 선택 처리
    // fileItem 자체 또는 자식 요소를 클릭한 경우에만 선택 처리
    if (!e.target.closest('.file-item')) return;
    
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
        
        // 더블클릭 이벤트와의 충돌을 방지하기 위한 타이머 제거
        // 즉시 선택 처리 (지연 없이)
        if (!fileItem.contains(e.target.closest('.file-icon')) && !fileItem.contains(e.target.closest('.file-name'))) {
            return;
        }
        
        // 모든 선택 해제 후 현재 항목 선택
        clearSelection();
        fileItem.classList.add('selected');
        selectedItems.add(fileName);
        updateButtonStates();
    }
    
    updateButtonStates();
}

// 파일 더블클릭 처리
function handleFileDblClick(e, fileItem) {
    // 이벤트 버블링 방지 (리스너에서도 하지만 중복 방지)
    e.preventDefault();
    e.stopPropagation();
    
    // 더블클릭 가능 여부 플래그 체크 제거
    
    const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
    const fileName = fileItem.getAttribute('data-name');
    const isParentDir = fileItem.getAttribute('data-parent-dir') === 'true';
    
    console.log(`더블클릭 이벤트 발생: ${fileName}, 폴더: ${isFolder}, 상위폴더: ${isParentDir}`);
    
    // 상위 폴더 처리
    if (isParentDir) {
        // 더블클릭 플래그 비활성화 제거
        navigateToParentFolder();
        return;
    }
    
    if (isFolder) {
        // 더블클릭 플래그 비활성화 제거
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
    
    // 파일 목록 로드 전에 마우스 포인터 상태 리셋 (호버 클래스 제거)
    // 마우스 위치 추적 로직에서 처리하므로 여기서는 제거 가능 (또는 유지해도 무방)
    // document.querySelectorAll('.file-item.hover, .file-item-grid.hover').forEach(item => {
    //     item.classList.remove('hover');
    // });
    
    // 마우스 포인터 위치 재설정을 위한 강제 mousemove 이벤트 제거
    
    // 파일 목록 로드
    loadFiles(newPath);
    
    // 선택 초기화
    clearSelection();
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
    
    // 더블클릭 이벤트 리스너 제거 (상위에서 위임하여 처리)
    
    // 컨텍스트 메뉴 (우클릭) 이벤트 연결
    fileItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, fileItem);
    });
    
    // 클릭 이벤트 연결 (mousedown 대신 click 이벤트 사용)
    fileItem.addEventListener('click', (e) => {
        // 우클릭은 여기서 처리하지 않음 (contextmenu 이벤트에서 처리)
        if (e.button !== 0) return;
        
        // 이름 변경 중이면 무시
        if (fileItem.classList.contains('renaming')) return;
        
        // Ctrl+클릭은 다중 선택을 위해 처리
        if (e.ctrlKey) {
            toggleSelection(fileItem);
        } 
        // Shift+클릭은 범위 선택을 위해 처리
        else if (e.shiftKey) {
            handleShiftSelect(fileItem);
        } 
        // 일반 클릭은 단일 선택을 위해 처리
        else {
            // 상위 폴더(..)는 선택 로직을 다르게 처리
            if (fileItem.getAttribute('data-parent-dir') === 'true') {
                return; // 상위 폴더는 선택하지 않음
            }
            
            // 모든 선택 해제 후 현재 항목 선택
            clearSelection();
            selectItem(fileItem);
        }
        
        // 이벤트 전파 중지 (드래그 선택 이벤트와 충돌 방지)
        e.stopPropagation();
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
        
        // 선택된 항목이 아니면 드래그 취소
        if (!fileItem.classList.contains('selected')) {
            // 선택되지 않은 항목은 먼저 선택
            clearSelection();
            selectItem(fileItem);
        }
        
        // 드래그 데이터 설정
        if (selectedItems.size > 1) {
            // 여러 항목 선택 시 모든 선택 항목 ID 저장
            e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
        } else {
            // 단일 항목 드래그
            e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
        }
        
        // 내부 드래그 표시
        e.dataTransfer.setData('application/webdav-internal', 'true');
        e.dataTransfer.effectAllowed = 'move';
        
        // 글로벌 드래그 상태 추적 시작
        window.startFileDrag(selectedItems);
        
        // 드래그 중 스타일 적용
        setTimeout(() => {
            document.querySelectorAll('.file-item.selected, .file-item-grid.selected').forEach(item => {
                item.classList.add('dragging');
            });
        }, 0);
    });
    
    // 드래그 종료 이벤트
    fileItem.addEventListener('dragend', (e) => {
        console.log('파일 항목 dragend 이벤트 발생');
        
        // 보편적인 드래그 상태 정리 함수 호출
        handleDragEnd();
        
        // 이벤트 캡처링이 진행되도록 중단하지 않음
    });
}

// 파일 더블클릭 처리를 위한 이벤트 위임 초기화
function initDoubleClickHandling() {
    const fileListContainer = document.getElementById('fileList'); // 이벤트 리스너를 부착할 컨테이너
    
    if (!fileListContainer) {
        console.error('fileList 요소를 찾을 수 없어 더블클릭 위임을 초기화할 수 없습니다.');
        return;
    }

    fileListContainer.addEventListener('dblclick', (e) => {
        // 클릭된 가장 가까운 file-item 또는 file-item-grid 요소를 찾음
        const fileItem = e.target.closest('.file-item, .file-item-grid');
        
        // 해당 요소를 찾았을 경우에만 처리
        if (fileItem) {
            // 이름 변경 입력 필드 클릭 시 무시
            if (e.target.classList.contains('rename-input')) return;

            // 이벤트 기본 동작 및 전파 중지
            e.preventDefault();
            e.stopPropagation();
            
            // 기존 더블클릭 핸들러 호출
            handleFileDblClick(e, fileItem);
        }
    });
}

// 마우스 위치 추적 및 호버 효과 제거 (단순화를 위해)
// document.addEventListener('mousemove', function(e) {
//     // 현재 마우스 위치 저장
//     window.mouseX = e.clientX;
//     window.mouseY = e.clientY;
//     
//     // 마우스 이벤트 대상 요소에 호버 클래스 추가
//     const fileItem = e.target.closest('.file-item, .file-item-grid');
//     if (fileItem) {
//         // 기존 호버 클래스 제거
//         document.querySelectorAll('.file-item.hover, .file-item-grid.hover').forEach(item => {
//             item.classList.remove('hover');
//         });
//         
//         // 현재 요소에 호버 클래스 추가
//         fileItem.classList.add('hover');
//     }
// });

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
    initDoubleClickHandling(); // 더블클릭 처리 초기화 추가
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
}
