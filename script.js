// 전역 변수
const API_BASE_URL = window.location.origin;
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
    let isSelecting = false;
    let startClientX, startClientY; // 클라이언트 좌표 저장
    
    // 마우스 이벤트를 file-list에 연결 (파일 아이템 사이의 빈 공간 포함)
    fileList.addEventListener('mousedown', (e) => {
        // 파일 항목 또는 컨텍스트 메뉴에서 시작된 이벤트는 무시
        if (e.target.closest('.file-item') || e.target.closest('.file-list-header') 
            || e.target.closest('.context-menu') || e.button !== 0) {
            return;
        }
        
        e.preventDefault();
        
        // 초기 클라이언트 좌표 저장 (스크롤 위치와 무관)
        startClientX = e.clientX;
        startClientY = e.clientY;
        
        // 초기 스크롤 위치 저장
        const initialScrollTop = fileList.scrollTop;
        
        // Ctrl 키가 눌려있지 않으면 선택 해제
        if (!e.ctrlKey) {
            clearSelection();
        }
        
        isSelecting = true;
        
        // 선택 박스 초기화
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.position = 'fixed'; // fixed로 변경하여 스크롤과 무관하게 함
        selectionBox.style.left = `${startClientX}px`;
        selectionBox.style.top = `${startClientY}px`;
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
        
        // 시작 정보 저장
        selectionBox.dataset.startClientX = startClientX;
        selectionBox.dataset.startClientY = startClientY;
        selectionBox.dataset.initialScrollTop = initialScrollTop;
    });
    
    // 마우스 이동 이벤트
    document.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        
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
        
        // 디버그 로깅 추가
        console.log(`스크롤 정보: 초기=${initialScrollTop}, 현재=${currentScrollTop}, 차이=${scrollDiff}`);
        console.log(`선택 영역: top=${selectTop}, bottom=${selectBottom}`);
        
        // 목록 상단/하단 자동 스크롤
        const buffer = 50; // 자동 스크롤 감지 영역 (픽셀)
        
        if (e.clientY < rect.top + buffer) {
            // 상단으로 스크롤
            fileList.scrollTop -= 10;
        } else if (e.clientY > rect.bottom - buffer) {
            // 하단으로 스크롤
            fileList.scrollTop += 10;
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
        
        updateButtonStates();
    });
    
    // 마우스 업 이벤트
    document.addEventListener('mouseup', () => {
        if (!isSelecting) return;
        
        isSelecting = false;
        
        // 선택 박스 숨기기
        const selectionBox = document.getElementById('selectionBox');
        selectionBox.style.display = 'none';
    });
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
        })
        .catch(error => {
            console.error('Error:', error);
            statusInfo.textContent = `오류: ${error.message}`;
            hideLoading();
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
                
                // 클릭 이벤트 추가
                parentItem.addEventListener('click', () => {
                    navigateToParentFolder();
                });
                
                // 컨테이너에 추가
                filesContainer.appendChild(parentItem);
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
                            if (e.target.closest('.file-item').clickTimer) {
                                clearTimeout(e.target.closest('.file-item').clickTimer);
                                e.target.closest('.file-item').clickTimer = null;
                                navigateToParentFolder();
                            } else {
                                e.target.closest('.file-item').clickTimer = setTimeout(() => {
                                    e.target.closest('.file-item').clickTimer = null;
                                }, 400);
                            }
                            return;
                        }
                        
                        // 기존 핸들링 계속
                        handleFileClick(e, fileItem);
                    });
                    
                    // 더블클릭 이벤트
                    fileItem.addEventListener('dblclick', (e) => {
                        if (e.target.classList.contains('rename-input')) return;
                        
                        // 파일/폴더 더블클릭 처리
                        const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
                        const name = fileItem.getAttribute('data-name');
                        
                        if (isFolder) {
                            navigateToFolder(name);
                        } else {
                            openFile(name);
                        }
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
        const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
        
        if (fileItem.clickTimer) {
            clearTimeout(fileItem.clickTimer);
            fileItem.clickTimer = null;
            // 더블클릭 효과는 dblclick 이벤트에서 처리됨
            return;
        }
        
        fileItem.clickTimer = setTimeout(() => {
            fileItem.clickTimer = null;
            
            // 모든 선택 해제 후 현재 항목 선택
            clearSelection();
            fileItem.classList.add('selected');
            selectedItems.add(fileName);
            updateButtonStates();
        }, 300); // 300ms로 조정
    }
    
    updateButtonStates();
}

// 파일 더블클릭 처리
function handleFileDblClick(e, fileItem) {
    const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
    const fileName = fileItem.getAttribute('data-name');
    
    if (isFolder) {
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

// 선택 항목 삭제
function deleteSelectedItems() {
    if (selectedItems.size === 0) return;
    
    // 선택항목에서 상위 디렉토리(..) 제거
    const itemsToDelete = new Set(selectedItems);
    itemsToDelete.delete('..');
    
    if (itemsToDelete.size === 0) {
        alert('삭제할 항목이 없습니다. 상위 폴더는 삭제할 수 없습니다.');
        return;
    }
    
    // 잠긴 폴더에 속한 항목들 확인
    const lockedItems = [];
    const deleteableItems = [];
    
    itemsToDelete.forEach(itemId => {
        const path = currentPath ? `${currentPath}/${itemId}` : itemId;
        
        // 잠긴 폴더 확인
        if (isPathLocked(path)) {
            lockedItems.push(itemId);
        } else {
            deleteableItems.push(itemId);
        }
    });
    
    // 잠긴 폴더에 속한 항목이 있으면 경고창 한 번만 표시
    if (lockedItems.length > 0) {
        const message = lockedItems.length === 1 
            ? `'${lockedItems[0]}'은(는) 잠긴 폴더이므로 삭제할 수 없습니다.` 
            : `${lockedItems.length}개 항목은 잠긴 폴더이므로 삭제할 수 없습니다.`;
        alert(message);
        
        // 삭제 가능한 항목이 없으면 종료
        if (deleteableItems.length === 0) {
            return;
        }
    }
    
    const itemsText = deleteableItems.length > 1 
        ? `${deleteableItems.length}개 항목` 
        : document.querySelector(`.file-item.selected[data-name="${deleteableItems[0]}"]`).getAttribute('data-name');
    
    if (confirm(`정말 ${itemsText}을(를) 삭제하시겠습니까?`)) {
        // 선택된 모든 항목 삭제
        const promises = [];
        
        deleteableItems.forEach(itemId => {
            const path = currentPath ? `${currentPath}/${itemId}` : itemId;
            // 경로에 한글이 포함된 경우를 위해 인코딩 처리
            const encodedPath = encodeURIComponent(path);
            
            promises.push(
                fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 403) {
                            throw new Error(`${itemId}는 잠긴 폴더이므로 삭제할 수 없습니다.`);
                        } else {
                            throw new Error(`${itemId} 삭제 실패`);
                        }
                    }
                    return itemId;
                })
            );
        });
        
        if (promises.length === 0) {
            return; // 모든 항목이 잠긴 폴더인 경우
        }
        
        showLoading();
        statusInfo.textContent = '삭제 중...';
        
        Promise.all(promises)
            .then(() => {
                loadFiles(currentPath); // 파일 목록 새로고침
                statusInfo.textContent = `${promises.length}개 항목 삭제됨`;
            })
            .catch(error => {
                alert(`오류 발생: ${error.message}`);
                hideLoading();
                loadFiles(currentPath);
            });
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

// 드래그 종료 처리
function handleDragEnd() {
    // 드래그 스타일 제거
    document.querySelectorAll('.file-item.dragging').forEach(item => {
        item.classList.remove('dragging');
    });
    
    // 드래그 오버 스타일 제거
    document.querySelectorAll('.file-item.drag-over').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    // 파일 리스트에 이벤트 위임 사용 - 동적으로 생성된 파일 항목에도 이벤트 처리
    const fileList = document.getElementById('fileList');
    const fileView = document.getElementById('fileView');
    const dropZone = document.getElementById('dropZone');
    
    if (!dropZone) {
        console.error('드롭존 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 파일 드래그 이벤트 위임
    fileList.addEventListener('dragstart', (e) => {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        // 상위 폴더는 드래그되지 않도록 방지
        if (fileItem.getAttribute('data-parent-dir') === 'true') {
            e.preventDefault();
            return;
        }
        
        // 마우스 다운 이벤트와 드래그 시작 사이의 이동 거리를 계산
        const mouseDownX = parseInt(fileItem.dataset.mouseDownX || '0');
        const mouseDownY = parseInt(fileItem.dataset.mouseDownY || '0');
        const mouseDownTime = parseInt(fileItem.dataset.mouseDownTime || '0');
        const currentTime = Date.now();
        const timeDiff = currentTime - mouseDownTime;
        
        // 일정 시간 내에 마우스를 누르고 드래그를 시작했을 때만 이동 처리
        const isQuickDrag = timeDiff < 300; // 300ms 내에 드래그 시작
        
        // 파일이 이미 선택되어 있고, 빠르게 드래그한 경우에만 이동 처리 허용
        const isAlreadySelected = fileItem.classList.contains('selected');
        
        // 이미 선택된 항목이 없거나 빠른 드래그가 아닌 경우 드래그를 취소하고 선택 모드로 동작
        if (!isAlreadySelected || !isQuickDrag) {
            e.preventDefault(); // 드래그 취소
            return;
        }
        
        // 이제부터는 이미 선택된 항목에 대한 빠른 드래그만 이동으로 처리
        
        // 드래그 중인 요소 식별
        const fileId = fileItem.getAttribute('data-name');
        console.log('드래그 시작:', fileId);
        
        // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
        if (selectedItems.size > 1 && fileItem.classList.contains('selected')) {
            // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
            e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
            e.dataTransfer.effectAllowed = 'move';
        } else {
            // 단일 항목 드래그
            e.dataTransfer.setData('text/plain', fileId);
            e.dataTransfer.effectAllowed = 'move';
        }
        
        // 내부 파일 드래그임을 표시하는 데이터 추가
        e.dataTransfer.setData('application/webdav-internal', 'true');
        
        // 드래그 중 스타일 적용
        setTimeout(() => {
            document.querySelectorAll('.file-item.selected').forEach(item => {
                item.classList.add('dragging');
            });
        }, 0);
    });
    
    // 드래그 종료 이벤트 위임
    fileList.addEventListener('dragend', (e) => {
        // 드래그 스타일 제거
        document.querySelectorAll('.file-item.dragging').forEach(item => {
            item.classList.remove('dragging');
        });
        
        // 드래그 오버 스타일 제거
        document.querySelectorAll('.file-item.drag-over').forEach(item => {
            item.classList.remove('drag-over');
        });
        
        // 드롭존 비활성화
        dropZone.classList.remove('active');
    });
    
    // 드래그 진입 이벤트 위임 - 폴더에만 적용
    fileList.addEventListener('dragenter', (e) => {
        e.preventDefault();
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        // 상위 폴더인 경우 드래그 오버 스타일 적용하지 않음
        if (fileItem.getAttribute('data-parent-dir') === 'true') {
            return;
        }
        
        // 폴더인 경우에만 처리하고 시각적 표시
        if (fileItem.getAttribute('data-is-folder') === 'true') {
            // 내부 드래그인 경우 선택된 폴더에 대한 드래그 무시
            if (isInternalDrag(e) && fileItem.classList.contains('selected')) {
                console.log('자기 자신이나 하위 폴더에 드래그 불가: ', fileItem.getAttribute('data-name'));
                return;
            }
            
            console.log('드래그 진입:', fileItem.getAttribute('data-name'));
            fileItem.classList.add('drag-over');
        }
    });
    
    // 드래그 영역 위 이벤트 위임
    fileList.addEventListener('dragover', (e) => {
        e.preventDefault(); // 드롭 허용
        e.stopPropagation(); // 이벤트 버블링 방지
        
        const fileItem = e.target.closest('.file-item');
        
        // 파일 항목이 없거나 드래그 타겟이 파일 리스트인 경우
        if (!fileItem || e.target === fileList || e.target === fileView) {
            // 내부 드래그인 경우에는 활성화하지 않음 (전체 드롭존 비활성화)
            // if (!isInternalDrag(e) && e.dataTransfer.types.includes('Files')) {
            //     dropZone.classList.add('active');
            // }
            return;
        }
        
        // 상위 폴더인 경우 드래그 오버 처리하지 않음
        if (fileItem.getAttribute('data-parent-dir') === 'true') {
            e.dataTransfer.dropEffect = 'none'; // 드롭 불가능 표시
            return;
        }
        
        // 폴더인 경우에만 처리
        if (fileItem.getAttribute('data-is-folder') === 'true') {
            // 내부 드래그인 경우 선택된 폴더에 대한 드래그 무시
            if (isInternalDrag(e) && fileItem.classList.contains('selected')) {
                e.dataTransfer.dropEffect = 'none'; // 드롭 불가능 표시
                return;
            }
            
            // 드롭존 비활성화 - 폴더에 드래그할 때는 전체 드롭존이 아닌 폴더 자체에 표시
            dropZone.classList.remove('active');
            
            // 폴더에 드래그 오버 스타일 적용
            fileItem.classList.add('drag-over');
            
            // 적절한 드롭 효과 설정
            if (isInternalDrag(e)) {
                e.dataTransfer.dropEffect = 'move'; // 내부 파일은 이동
            } else {
                e.dataTransfer.dropEffect = 'copy'; // 외부 파일은 복사
            }
        }
    });
    
    // 드래그 영역 벗어날 때 이벤트 위임
    fileList.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 파일/폴더 항목에서의 dragleave 처리
        const fileItem = e.target.closest('.file-item');
        if (fileItem) {
            // 정확한 dragleave 확인 (자식 요소로 이동하는 경우 무시)
            const rect = fileItem.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;
            
            // 실제로 영역을 벗어났는지 확인
            if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
                fileItem.classList.remove('drag-over');
            }
        }
        
        // 전체 드롭존 이탈 확인
        const rect = dropZone.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        // 실제로 영역을 벗어났는지 확인
        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            dropZone.classList.remove('active');
        }
    });
    
    // 드롭 이벤트 위임
    fileList.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 드롭존 비활성화
        dropZone.classList.remove('active');
        
        // 파일 항목 찾기
        const fileItem = e.target.closest('.file-item');
        
        // 드롭 위치 로깅
        console.log('드롭 이벤트 발생 위치:', e.target.className);
        
        // 파일 항목이 없는 경우 (빈 공간에 드롭)
        if (!fileItem) {
            console.log('빈 공간에 드롭됨');
            // 외부 파일 업로드 처리
            if (e.dataTransfer.files.length > 0) {
                handleExternalFileDrop(e);
            }
            return;
        }
        
        // 상위 폴더에 드롭되는 경우 차단
        if (fileItem.getAttribute('data-parent-dir') === 'true') {
            console.log('상위 폴더에 드롭되어 무시됨');
            return;
        }
        
        // 드롭된 파일 항목 정보 로깅
        console.log('드롭 대상 폴더:', fileItem.getAttribute('data-name'), 
                  '폴더 여부:', fileItem.getAttribute('data-is-folder'));
        
        // 드래그 오버 스타일 제거
        fileItem.classList.remove('drag-over');
        
        // 폴더가 아닌 경우 무시
        if (fileItem.getAttribute('data-is-folder') !== 'true') {
            console.log('파일 항목에 드롭됨 - 현재 폴더에 업로드합니다.');
            // 외부 파일 업로드 처리 - 현재 폴더에 업로드
            if (e.dataTransfer.files.length > 0) {
                handleExternalFileDrop(e);
            }
            return;
        }
        
        // 내부 드래그인 경우만 선택 항목 확인
        if (isInternalDrag(e)) {
            console.log('내부 파일 드래그 감지됨');
        // 선택된 항목들이 자기 자신을 포함하고 있으면 무시
            if (fileItem.classList.contains('selected')) {
                console.log('폴더가 선택된 상태에서는 자기자신에게 드롭하여 무시됨');
            return;
        }
        
            // 내부 파일 이동 처리
            handleInternalFileDrop(e, fileItem);
        } else if (e.dataTransfer.files.length > 0) {
            console.log('외부 파일 드래그 감지됨');
            // 외부 파일 업로드를 지정 폴더로 처리
            handleExternalFileDrop(e, fileItem);
        }
    });
    
    // 드롭존 이벤트 처리 (파일 업로드용)
    
    // 드래그 영역 진입
    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 외부 파일인지 확인
        const isExternalFile = e.dataTransfer.types.includes('Files') && !isInternalDrag(e);
        
        if (isExternalFile) {
            // 폴더 항목 확인
            const fileItem = e.target.closest('.file-item');
            
            // 폴더에 드래그하는 경우 해당 폴더만 강조
            if (fileItem && fileItem.getAttribute('data-is-folder') === 'true') {
                // 상위 폴더인 경우 드래그 강조 제외
                if (fileItem.getAttribute('data-parent-dir') === 'true') {
                    return;
                }
                
                // 전체 드롭존 비활성화
                dropZone.classList.remove('active');
                
                // 특정 폴더 강조
                fileItem.classList.add('drag-over');
                console.log('폴더에 외부 파일 드래그 진입:', fileItem.getAttribute('data-name'));
            } else {
                // 전체 드롭존 비활성화 - 폴더에만 드롭 가능하도록 함
                // dropZone.classList.add('active');
                // console.log('외부 파일 드래그 진입 - 드롭존 활성화');
            }
        }
    });
    
    // 드래그 영역 위
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 외부 파일인지 확인
        const isExternalFile = e.dataTransfer.types.includes('Files') && !isInternalDrag(e);
        
        if (isExternalFile) {
            // 폴더 항목 확인
            const fileItem = e.target.closest('.file-item');
            
            // 폴더에 드래그하는 경우 해당 폴더만 강조
            if (fileItem && fileItem.getAttribute('data-is-folder') === 'true') {
                // 상위 폴더인 경우 드래그 강조 제외
                if (fileItem.getAttribute('data-parent-dir') === 'true') {
                    e.dataTransfer.dropEffect = 'none'; // 드롭 불가능 표시
                    return;
                }
                
                // 전체 드롭존 비활성화
                dropZone.classList.remove('active');
                
                // 특정 폴더 강조
                fileItem.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'copy';
            } else if (fileItem) {
                // 파일 항목에 드래그할 경우 시각적 표시
                dropZone.classList.remove('active');
                fileItem.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'copy';
            } else {
                // 빈 공간 (전체 드롭존 활성화)
                dropZone.classList.add('active');
            }
        }
    });
    
    // 드래그 영역 이탈
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = dropZone.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        // 실제로 영역을 벗어났는지 확인
        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            dropZone.classList.remove('active');
        }
    });
    
    // 드롭 이벤트
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('active');
        
        // 외부 파일 업로드 처리
        if (e.dataTransfer.files.length > 0) {
            handleExternalFileDrop(e);
        }
    });
    
    // 개발 모드에서 폴더 항목 CSS 선택자 유효성 확인
    console.log('폴더 항목 개수:', document.querySelectorAll('.file-item[data-is-folder="true"]').length);
    document.querySelectorAll('.file-item[data-is-folder="true"]').forEach(folder => {
        console.log('폴더 항목:', folder.getAttribute('data-name'));
    });
}

// 내부 드래그인지 확인하는 함수
function isInternalDrag(e) {
    return e.dataTransfer.types && e.dataTransfer.types.includes('application/webdav-internal');
}

// 내부 파일 드롭 처리 함수
function handleInternalFileDrop(e, targetFolderItem) {
    // 호출 카운터 증가 - 내부 파일 이동 추적
    dragDropMoveCounter++;
    console.log(`드래그앤드롭 파일 이동 호출 횟수: ${dragDropMoveCounter}`);
    statusInfo.textContent = `드래그앤드롭 파일 이동 호출 횟수: ${dragDropMoveCounter}`;
    
    const targetFolder = targetFolderItem.getAttribute('data-name');
    console.log('대상 폴더:', targetFolder);
    
    // 내부 파일 이동 처리 - dataTransfer에서 데이터 가져오기
    try {
        const dataTransferred = e.dataTransfer.getData('text/plain');
        console.log('이동할 데이터:', dataTransferred);
        
        let itemsToMove = [];
        
        try {
            // JSON 형식으로 저장된 배열인지 확인 (다중 선택 항목)
            const parsedData = JSON.parse(dataTransferred);
            if (Array.isArray(parsedData)) {
                itemsToMove = parsedData;
                console.log('JSON 배열 형식의 데이터 파싱 성공:', itemsToMove);
            } else {
                itemsToMove = [dataTransferred];
                console.log('JSON 객체 형식의 데이터:', itemsToMove);
            }
        } catch (e) {
            // JSON 파싱 실패 - 단일 항목 문자열
            console.log('일반 텍스트 데이터:', dataTransferred);
            if (dataTransferred.includes(',')) {
                itemsToMove = dataTransferred.split(',');
                console.log('쉼표로 구분된 데이터 파싱:', itemsToMove);
            } else {
                itemsToMove = [dataTransferred];
                console.log('단일 항목 데이터:', itemsToMove);
            }
        }
        
        // 이동할 항목 로그
        console.log('이동할 항목 목록:', itemsToMove);
        
        // 선택된 모든 파일을 이동
        if (itemsToMove.length > 0) {
            // 중복 호출 방지를 위한 디바운싱 처리
            if (window.lastDropTime && (Date.now() - window.lastDropTime < 100)) {
                console.log('중복 드롭 이벤트 감지, 무시합니다.');
                return;
            }
            window.lastDropTime = Date.now();
            
            // 자동 이동 처리 - 확인창 없이 바로 이동
            statusInfo.textContent = `${itemsToMove.length}개 항목을 '${targetFolder}' 폴더로 이동 중...`;
            showLoading();
            
            // 새로운 moveToFolder 함수 사용 - 자동 이동 옵션 추가
            moveToFolder(itemsToMove, targetFolder, true) // true: 자동 이동(확인 메시지 없음)
            .then(() => {
                console.log('파일 이동 성공');
                statusInfo.textContent = `${itemsToMove.length}개 항목을 '${targetFolder}' 폴더로 이동했습니다.`;
                hideLoading();
            })
            .catch(error => {
                console.error('파일 이동 과정 오류:', error);
                statusInfo.textContent = `파일 이동 과정 오류: ${error}`;
                hideLoading();
            });
        }
    } catch (e) {
        console.error('드롭 이벤트 처리 오류:', e);
        statusInfo.textContent = `드롭 이벤트 처리 오류: ${e.message}`;
        hideLoading();
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
            // isHandlingDrop = false; // 플래그는 finally에서 해제
            return;
        }

        // DataTransferItemList 사용
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) {
            console.log('드롭된 항목이 없습니다.');
            // isHandlingDrop = false;
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
            const entry = items[i].webkitGetAsEntry();
            if (entry) {
                promises.push(traverseFileTree(entry, '', filesWithPaths));
            }
        }

        await Promise.all(promises);

        hideLoading();

        if (filesWithPaths.length === 0) {
            statusInfo.textContent = '업로드할 파일을 찾을 수 없습니다.';
            console.log('업로드할 파일이 없습니다.');
            // isHandlingDrop = false;
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
        const currentPath = path ? `${path}/${entry.name}` : entry.name;

        if (entry.isFile) {
            entry.file(file => {
                // 숨김 파일 (.으로 시작)은 제외
                if (!file.name.startsWith('.')) {
                    // 파일 이름 길이 체크 및 처리
                    const maxFileNameLength = 200; // 최대 파일명 길이 설정
                    let fileName = file.name;
                    let relativePath = currentPath;
                    
                    // 파일명이 너무 길면 잘라내기
                    if (fileName.length > maxFileNameLength) {
                        const extension = fileName.lastIndexOf('.') > 0 ? fileName.substring(fileName.lastIndexOf('.')) : '';
                        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.') > 0 ? fileName.lastIndexOf('.') : fileName.length);
                        const newFileName = fileNameWithoutExt.substring(0, maxFileNameLength - extension.length - 3) + '...' + extension;
                        
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
                        filesWithPaths.push({ file: file, relativePath: currentPath });
                    }
                    console.log(`파일 추가: ${relativePath}`);
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

            console.log(`폴더 탐색: ${currentPath}`);
            const dirReader = entry.createReader();
            let allEntries = [];

            const readEntries = () => {
                dirReader.readEntries(entries => {
                    if (entries.length === 0) {
                        // 모든 항목을 읽었으면 재귀 호출 실행
                        Promise.all(allEntries.map(subEntry => traverseFileTree(subEntry, currentPath, filesWithPaths)))
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
                        String(now.getMinutes()).padStart(2, '0');
    
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
    // 기본 기능 초기화
    initModals();
    initContextMenu();
    initDragSelect();
    initDragAndDrop();
    initShortcuts();
    initViewModes();
    initHistoryNavigation(); // 히스토리 네비게이션 초기화 추가
    
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
    const targetPath = currentPath ? `${currentPath}/${targetFolder}` : targetFolder;
    
    // 호출 카운터 증가 - 함수 호출 추적
    dragDropMoveCounter++;
    console.log(`[moveToFolder] 파일 이동 함수 호출 횟수: ${dragDropMoveCounter}`);
    statusInfo.textContent = `파일 이동 함수 호출 횟수: ${dragDropMoveCounter}`;
    
    // 이동 중 상태 설정
    window.isMovingFiles = true;
    
    // 이동 전 충돌 항목 확인 (모든 항목에 대해 한 번만 확인)
    const conflictCheckPromises = itemsToMove.map(item => {
        const sourceFullPath = currentPath ? `${currentPath}/${item}` : item;
        const fileName = item;
        
        // 소스와 타겟이 같은 경로인지 확인
        if (sourceFullPath === `${targetPath}/${fileName}`) {
            console.log(`[${fileName}] 소스와 타겟이 동일합니다. 무시합니다.`);
            return { item, exists: false, skip: true };
        }
        
        // 대상 경로에 파일이 존재하는지 확인
        return fetch(`${API_BASE_URL}/api/files/${encodeURIComponent(targetPath)}/${encodeURIComponent(fileName)}`, {
            method: 'HEAD'
        })
        .then(response => {
            return { item, exists: response.ok, skip: false };
        })
        .catch(error => {
            console.error(`[${fileName}] 충돌 확인 오류:`, error);
            return { item, exists: false, skip: false, error };
        });
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
                const sourceFullPath = currentPath ? `${currentPath}/${item}` : item;
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
    // 직접 잠긴 폴더인지 확인
    if (lockedFolders.includes(path)) {
        return true;
    }
    
    // 상위 폴더가 잠겨 있는지 확인
    return lockedFolders.some(lockedPath => {
        return path.startsWith(lockedPath + '/');
    });
}

// 폴더 잠금 토글 함수 (수정: 명령 인자 추가)
function toggleFolderLock(action) {
    // 선택된 폴더 항목들 확인
    const selectedFolders = [];
    
    // 선택된 항목들 중에서 폴더만 필터링
    selectedItems.forEach(itemName => {
        const element = document.querySelector(`.file-item[data-name="${itemName}"]`);
        if (element && element.getAttribute('data-is-folder') === 'true') {
            const folderPath = currentPath ? `${currentPath}/${itemName}` : itemName;
            selectedFolders.push({
                name: itemName,
                path: folderPath,
                isLocked: isPathLocked(folderPath)
            });
        }
    });
    
    if (selectedFolders.length === 0) {
        alert('잠금/해제할 폴더를 선택해주세요.');
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
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`'${folder.name}' 폴더 ${action === 'lock' ? '잠금' : '잠금 해제'} 처리 실패`);
            }
            return response.json();
        })
        .then(() => {
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

// 잠금 상태 로드 함수
function loadLockStatus() {
    return fetch(`${API_BASE_URL}/api/lock-status`)
        .then(response => {
            if (!response.ok) {
                throw new Error('잠금 상태 조회 실패');
            }
            return response.json();
        })
        .then(data => {
            lockedFolders = data.lockState;
            console.log('잠금 폴더 목록:', lockedFolders);
            return lockedFolders;
        })
        .catch(error => {
            console.error('잠금 상태 조회 오류:', error);
            return [];
        });
}

// 파일 항목에서 마우스 다운 이벤트 처리 (드래그 시작을 위한)
function handleFileItemMouseDown(e, fileItem) {
    // 우클릭은 여기서 처리하지 않음 (contextmenu 이벤트에서 처리)
    if (e.button !== 0) return;
    
    // 마우스 위치 저장 (나중에 드래그 여부 판단을 위해)
    fileItem.dataset.mouseDownX = e.clientX;
    fileItem.dataset.mouseDownY = e.clientY;
    fileItem.dataset.mouseDownTime = Date.now();
    
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
        // 이미 선택된 항목을 클릭했다면 선택 상태 유지 (드래그 이동을 위해)
        if (fileItem.classList.contains('selected')) {
            // 선택 상태 유지 (드래그가 시작될 수 있음)
        } else {
            // 선택되지 않은 항목을 클릭했다면 새로 선택
            clearSelection();
            selectItem(fileItem);
        }
    }
    
    // 이벤트 전파 중지 (드래그 선택 이벤트와 충돌 방지)
    e.stopPropagation();
}

// 파일 항목 초기화 - 각 파일/폴더에 이벤트 연결
function initFileItem(fileItem) {
    const fileName = fileItem.getAttribute('data-name');
    
    // 더블클릭 이벤트 연결
    fileItem.addEventListener('dblclick', (e) => {
        handleFileDblClick(e, fileItem);
    });
    
    // 컨텍스트 메뉴 (우클릭) 이벤트 연결
    fileItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, fileItem);
    });
    
    // 클릭 이벤트 연결
    fileItem.addEventListener('mousedown', (e) => {
        handleFileItemMouseDown(e, fileItem);
    });
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    // 파일 리스트에 이벤트 위임 사용 - 동적으로 생성된 파일 항목에도 이벤트 처리
    const fileList = document.getElementById('fileList');
    const fileView = document.getElementById('fileView');
    const dropZone = document.getElementById('dropZone');
    
    if (!dropZone) {
        console.error('드롭존 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 파일 드래그 이벤트 위임
    fileList.addEventListener('dragstart', (e) => {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        // 상위 폴더는 드래그되지 않도록 방지
        if (fileItem.getAttribute('data-parent-dir') === 'true') {
            e.preventDefault();
            return;
        }
        
        // 마우스 다운 이벤트와 드래그 시작 사이의 이동 거리를 계산
        const mouseDownX = parseInt(fileItem.dataset.mouseDownX || '0');
        const mouseDownY = parseInt(fileItem.dataset.mouseDownY || '0');
        const mouseDownTime = parseInt(fileItem.dataset.mouseDownTime || '0');
        const currentTime = Date.now();
        const timeDiff = currentTime - mouseDownTime;
        
        // 일정 시간 내에 마우스를 누르고 드래그를 시작했을 때만 이동 처리
        const isQuickDrag = timeDiff < 300; // 300ms 내에 드래그 시작
        
        // 파일이 이미 선택되어 있고, 빠르게 드래그한 경우에만 이동 처리 허용
        const isAlreadySelected = fileItem.classList.contains('selected');
        
        // 이미 선택된 항목이 없거나 빠른 드래그가 아닌 경우 드래그를 취소하고 선택 모드로 동작
        if (!isAlreadySelected || !isQuickDrag) {
            e.preventDefault(); // 드래그 취소
            return;
        }
        
        // 이제부터는 이미 선택된 항목에 대한 빠른 드래그만 이동으로 처리
        
        // 드래그 중인 요소 식별
        const fileId = fileItem.getAttribute('data-name');
        console.log('드래그 시작:', fileId);
        
        // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
        if (selectedItems.size > 1 && fileItem.classList.contains('selected')) {
            // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
            e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
            e.dataTransfer.effectAllowed = 'move';
        } else {
            // 단일 항목 드래그
            e.dataTransfer.setData('text/plain', fileId);
            e.dataTransfer.effectAllowed = 'move';
        }
        
        // 내부 파일 드래그임을 표시하는 데이터 추가
        e.dataTransfer.setData('application/webdav-internal', 'true');
        
        // 드래그 중 스타일 적용
        setTimeout(() => {
            document.querySelectorAll('.file-item.selected').forEach(item => {
                item.classList.add('dragging');
            });
        }, 0);
    });
}
