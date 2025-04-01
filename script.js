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
    selectedItems.clear();
    document.querySelectorAll('.file-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    updateButtonStates();
}

// 항목 선택
function selectItem(item, addToSelection = false) {
    // 상위 폴더(..)는 선택 불가능하도록 처리
    if (item.getAttribute('data-parent-dir') === 'true') {
        return;
    }
    
    if (!addToSelection) {
        clearSelection();
    }
    
    item.classList.add('selected');
    selectedItems.add(item.getAttribute('data-name'));
    updateButtonStates();
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
            
            if (isFolder) {
                ctxOpen.innerHTML = '<i class="fas fa-folder-open"></i> 열기';
                ctxDownload.style.display = 'none';
            } else {
                ctxOpen.innerHTML = '<i class="fas fa-external-link-alt"></i> 열기';
                ctxDownload.style.display = 'flex';
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
    document.getElementById('ctxNewFolder').addEventListener('click', () => {
        folderNameInput.value = '';
        folderModal.style.display = 'flex';
        folderNameInput.focus();
    });
    
    // 압축 메뉴 이벤트 추가
    document.getElementById('ctxCompress').addEventListener('click', compressSelectedItems);
}

// 파일 열기 함수 (브라우저에서 직접 열기)
function openFile(fileName) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const encodedPath = encodeURIComponent(filePath);
    const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
    
    // 파일 확장자 확인
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    // 브라우저에서 볼 수 있는 파일 확장자
    const viewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
                          'mp4', 'webm', 'ogg', 'mp3', 'wav', 
                          'pdf', 'txt', 'html', 'htm', 'css', 'js', 'json', 'xml'];
    
    // 브라우저에서 볼 수 있는 파일인 경우
    if (viewableTypes.includes(fileExt)) {
        // 새 창에서 열기
        window.open(fileUrl, '_blank');
        statusInfo.textContent = `${fileName} 파일 열기`;
    } else {
        // 브라우저에서 직접 볼 수 없는 파일은 다운로드
        statusInfo.textContent = `${fileName} 다운로드 중...`;
        
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName);
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
    
    // 마우스 이벤트를 file-list에 연결 (파일 아이템 사이의 빈 공간 포함)
    fileList.addEventListener('mousedown', (e) => {
        // 파일 항목 또는 컨텍스트 메뉴에서 시작된 이벤트는 무시
        if (e.target.closest('.file-item') || e.target.closest('.file-list-header') 
            || e.target.closest('.context-menu') || e.button !== 0) {
            return;
        }
        
        e.preventDefault();
        
        // 초기 좌표 저장 - 스크롤 위치 고려
        const rect = fileList.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        
        // Ctrl 키가 눌려있지 않으면 선택 해제
        if (!e.ctrlKey) {
            clearSelection();
        }
        
        isSelecting = true;
        
        // 선택 박스 초기화
        const selectionBox = document.getElementById('selectionBox');
        
        // 선택 박스 위치와 크기 설정 - 스크롤 위치 고려
        selectionBox.style.left = `${startX - rect.left}px`;
        selectionBox.style.top = `${startY - rect.top + fileList.scrollTop}px`;
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
    });
    
    // 마우스 이동 이벤트
    document.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        
        const fileList = document.getElementById('fileList');
        const selectionBox = document.getElementById('selectionBox');
        const rect = fileList.getBoundingClientRect();
        
        // 현재 마우스 위치
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        // 박스 위치와 크기 계산 - 스크롤 위치 고려
        const scrollTop = fileList.scrollTop;
        const left = Math.min(currentX, startX) - rect.left;
        const top = Math.min(currentY, startY) - rect.top + scrollTop;
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        
        // 선택 박스 업데이트
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
        
        // 목록 상단/하단 자동 스크롤
        const buffer = 50; // 자동 스크롤 감지 영역 (픽셀)
        
        if (currentY < rect.top + buffer) {
            // 상단으로 스크롤
            fileList.scrollTop -= 10;
        } else if (currentY > rect.bottom - buffer) {
            // 하단으로 스크롤
            fileList.scrollTop += 10;
        }
        
        // 박스와 겹치는 파일 항목 선택 - 스크롤 위치 고려하여 계산
        const topWithScroll = top - scrollTop;
        const bottomWithScroll = topWithScroll + height;
        
        const items = document.querySelectorAll('.file-item');
        items.forEach(item => {
            const itemRect = item.getBoundingClientRect();
            
            const itemLeft = itemRect.left;
            const itemRight = itemRect.right;
            const itemTop = itemRect.top - rect.top;
            const itemBottom = itemRect.bottom - rect.top;
            
            const overlap = !(
                itemRight < Math.min(currentX, startX) ||
                itemLeft > Math.max(currentX, startX) ||
                itemBottom < topWithScroll ||
                itemTop > bottomWithScroll
            );
            
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
        visibleFiles.forEach(file => {
            // 파일 항목 생성
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.setAttribute('data-id', file.name);
            fileItem.setAttribute('data-name', file.name);
            fileItem.setAttribute('data-is-folder', file.isFolder);
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 설정
            
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
                
                if (e.ctrlKey) {
                    // Ctrl 키를 누른 상태로 클릭: 다중 선택
                    if (fileItem.classList.contains('selected')) {
                        fileItem.classList.remove('selected');
                        selectedItems.delete(file.name);
                    } else {
                        fileItem.classList.add('selected');
                        selectedItems.add(file.name);
                    }
                } else if (e.shiftKey && selectedItems.size > 0) {
                    // Shift 키를 누른 상태로 클릭: 범위 선택
                    const items = Array.from(document.querySelectorAll('.file-item:not([data-parent-dir="true"])'));
                    const firstSelected = items.findIndex(item => item.classList.contains('selected'));
                    const currentIndex = items.indexOf(fileItem);
                    
                    // 범위 설정
                    const start = Math.min(firstSelected, currentIndex);
                    const end = Math.max(firstSelected, currentIndex);
                    
                    // 범위 내 모든 항목 선택
                    for (let i = start; i <= end; i++) {
                        items[i].classList.add('selected');
                        selectedItems.add(items[i].getAttribute('data-name'));
                    }
                } else {
                    // 일반 클릭: 단일 선택
                    if (fileItem.getAttribute('data-is-folder') === 'true') {
                        if (fileItem.clickTimer) {
                            clearTimeout(fileItem.clickTimer);
                            fileItem.clickTimer = null;
                            // 더블클릭: 폴더 열기
                            navigateToFolder(file.name);
                            return;
                        }
                        
                        fileItem.clickTimer = setTimeout(() => {
                            fileItem.clickTimer = null;
                            
                            // 모든 선택 해제 후 현재 항목 선택
                            clearSelection();
                            fileItem.classList.add('selected');
                            selectedItems.add(file.name);
                            updateButtonStates();
                        }, 400); // 400ms로 설정
                    } else {
                        // 파일인 경우
                        if (fileItem.clickTimer) {
                            clearTimeout(fileItem.clickTimer);
                            fileItem.clickTimer = null;
                            // 더블클릭: 파일 열기
                            openFile(file.name);
                            return;
                        }
                        
                        fileItem.clickTimer = setTimeout(() => {
                            fileItem.clickTimer = null;
                            // 단일 클릭: 파일 선택
                            clearSelection();
                            fileItem.classList.add('selected');
                            selectedItems.add(file.name);
                            updateButtonStates();
                        }, 400); // 400ms로 설정
                    }
                }
                
                updateButtonStates();
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
            selectedItems.delete(fileItem.getAttribute('data-id'));
        } else {
            fileItem.classList.add('selected');
            selectedItems.add(fileItem.getAttribute('data-id'));
        }
    } else if (e.shiftKey && selectedItems.size > 0) {
        // Shift 키로 범위 선택
        const items = Array.from(document.querySelectorAll('.file-item'));
        const lastSelected = document.querySelector('.file-item.selected');
        
        if (lastSelected) {
            const startIndex = items.indexOf(lastSelected);
            const endIndex = items.indexOf(fileItem);
            
            const start = Math.min(startIndex, endIndex);
            const end = Math.max(startIndex, endIndex);
            
            clearSelection();
            
            for (let i = start; i <= end; i++) {
                items[i].classList.add('selected');
                selectedItems.add(items[i].getAttribute('data-name'));
            }
        }
    } else {
        // 일반 클릭: 단일 선택
        selectItem(fileItem);
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
        const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
        
        // 이미지, 비디오, PDF 등 브라우저에서 열 수 있는 파일 형식
        const viewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 
                              'mp4', 'webm', 'ogg', 'mp3', 'wav', 
                              'pdf', 'txt', 'html', 'htm', 'css', 'js', 'json', 'xml'];
        
        if (viewableTypes.includes(fileExt)) {
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
    
    // 강제 다운로드 진행
    const link = document.createElement('a');
    link.href = fileUrl;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
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
    
    const itemsText = itemsToDelete.size > 1 
        ? `${itemsToDelete.size}개 항목` 
        : document.querySelector(`.file-item.selected[data-name="${[...itemsToDelete][0]}"]`).getAttribute('data-name');
    
    if (confirm(`정말 ${itemsText}을(를) 삭제하시겠습니까?`)) {
        // 선택된 모든 항목 삭제
        const promises = [];
        
        itemsToDelete.forEach(itemId => {
            const path = currentPath ? `${currentPath}/${itemId}` : itemId;
            // 경로에 한글이 포함된 경우를 위해 인코딩 처리
            const encodedPath = encodeURIComponent(path);
            
            promises.push(
                fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`${itemId} 삭제 실패`);
                    }
                    return itemId;
                })
            );
        });
        
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
        
        // 현재 선택된 항목이 아니면 다른 선택 모두 해제하고 이 항목만 선택
        if (!fileItem.classList.contains('selected')) {
            clearSelection();
            fileItem.classList.add('selected');
            selectedItems.add(fileId);
            updateButtonStates();
            }
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
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        // 정확한 dragleave 확인 (자식 요소로 이동하는 경우 무시)
        const rect = fileItem.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        // 실제로 영역을 벗어났는지 확인
        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
        fileItem.classList.remove('drag-over');
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
            console.log('폴더가 아닌 항목에 드롭되어 무시됨');
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
            } else {
                // 전체 드롭존 비활성화 - 폴더에만 드롭 가능하도록 함
                // dropZone.classList.add('active');
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
    
    // 드롭존 드롭 이벤트
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('active');
        
        // 이미 진행 중인 업로드가 있는지 확인
        if (progressContainer.style.display === 'block') {
            statusInfo.textContent = '이미 업로드가 진행 중입니다. 완료 후 다시 시도하세요.';
            console.log('이미 진행 중인 업로드가 있어 새 업로드를 취소합니다.');
            return;
        }
        
        try {
            // DataTransfer 객체에서 항목 검사
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                const entries = [];
                let hasDirectory = false;
                
                // 항목 검사하여 폴더 여부 확인
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i];
                    
                    // webkitGetAsEntry 지원 확인
                    if (item.webkitGetAsEntry) {
                        const entry = item.webkitGetAsEntry();
                        if (entry) {
                            entries.push(entry);
                            if (entry.isDirectory) {
                                hasDirectory = true;
                                console.log(`폴더 감지: ${entry.name}`);
                            }
                        }
                    }
                }
                
                // 폴더가 하나라도 있으면 폴더 처리 로직으로 진행
                if (hasDirectory) {
                    console.log(`폴더 드롭: ${entries.length}개 항목 (폴더 포함)`);
                    statusInfo.textContent = '폴더 업로드 시작...';
                    
                    // 업로드 소스 설정
                    uploadSource = 'dragdrop';
                    
                    // 항목 재귀 처리 시작
                    processEntries(entries);
                    return;
                }
            }
            
            // 폴더가 없는 경우 일반 파일 업로드 처리
            if (e.dataTransfer.files.length > 0) {
                console.log(`일반 파일 드롭: ${e.dataTransfer.files.length}개 파일`);
                handleExternalFileDrop(e);
            }
        } catch (error) {
            console.error('드롭 이벤트 처리 오류:', error);
            statusInfo.textContent = `드롭 이벤트 처리 오류: ${error.message}`;
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
function handleExternalFileDrop(e, targetFolderItem = null) {
    // 진행 중인 업로드가 있는지 확인
    if (progressContainer.style.display === 'block') {
        statusInfo.textContent = '이미 업로드가 진행 중입니다. 완료 후 다시 시도하세요.';
        console.log('이미 진행 중인 업로드가 있어 새 업로드를 취소합니다.');
        return;
    }
    
    // 파일 객체 가져오기
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    // 업로드 소스 설정 및 카운터 초기화
    uploadSource = 'dragdrop';
    dragDropCounter = 0;
    
    // 타겟 폴더가 지정된 경우
    if (targetFolderItem) {
        const targetFolder = targetFolderItem.getAttribute('data-name');
        console.log('외부 파일 드래그 감지:', files.length, '개 파일, 대상 폴더:', targetFolder);
        
        // 현재 폴더에 파일 업로드
        const targetPath = currentPath ? `${currentPath}/${targetFolder}` : targetFolder;
        
        // 수정: 현재 경로를 임시로 변경하여 업로드 후 원래 경로로 복원
        const originalPath = currentPath;
        currentPath = targetPath;
        
        uploadFiles(files);
        currentPath = originalPath;
    } else {
        // 현재 위치에 업로드
        console.log('외부 파일 드래그 감지:', files.length, '개 파일, 현재 경로에 업로드');
        uploadFiles(files);
    }
}

// 특정 폴더에 파일 업로드
function uploadFiles(files, path) {
    if (files.length === 0) {
        removeProgressBar();
        showMessage('업로드할 파일이 없습니다.', 'error');
        return;
    }
    
    // UI 업데이트 - 업로드 시작
    showMessage(`${files.length}개 파일 업로드 중...`, 'info');
    showProgressBar(0);
    updateUploadStatus(true);
    
    const formData = new FormData();
    
    // 업로드 경로 추가
    if (path && path !== '/') {
        formData.append('path', path);
    }
    
    // 폴더 경로 정보 배열
    const filePaths = [];
    
    // 파일 추가 및 경로 정보 수집
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 파일 이름과 경로 로깅
        console.log(`업로드 파일[${i}]: ${file.name}`);
        
        // webkitRelativePath가 있으면 폴더 업로드임
        let relativePath = '';
        if (file.webkitRelativePath) {
            relativePath = file.webkitRelativePath;
            console.log(`파일 경로[${i}]: ${relativePath}`);
        }
        
        // 파일 추가
        formData.append('files', file);
        
        // 경로 정보 추가 (폴더 구조 유지)
        filePaths.push(relativePath);
    }
    
    // 파일 경로 정보 추가 (폴더 구조 보존용)
    if (filePaths.length > 0 && filePaths.some(path => path)) {
        console.log('폴더 구조 정보 포함:', filePaths);
        filePaths.forEach(filePath => {
            formData.append('filepaths', filePath);
        });
    }
    
    // 업로드 요청 설정
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    
    // 진행률 이벤트 처리
    xhr.upload.addEventListener('progress', function(event) {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            updateProgressBar(percent);
        }
    });
    
    // 요청 완료 이벤트 처리
    xhr.onload = function() {
        // 업로드 상태 초기화
        updateUploadStatus(false);
        
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const response = JSON.parse(xhr.responseText);
                
                // 성공 메시지 표시
                showMessage(response.message || `${files.length}개 파일 업로드 완료!`, 'success');
                console.log('업로드 성공 응답:', response);
                
                // 파일 목록 새로고침
                refreshFileList();
            } catch (e) {
                console.error('응답 파싱 오류:', e);
                showMessage('업로드 완료되었으나 응답 처리 중 오류가 발생했습니다.', 'warning');
            }
        } else if (xhr.status === 207) {
            // 부분 성공 (일부 파일 실패)
            try {
                const response = JSON.parse(xhr.responseText);
                showMessage(response.message || `일부 파일 업로드 실패: ${response.failed}개 오류`, 'warning');
                console.warn('일부 파일 업로드 실패:', response.errors);
                
                // 파일 목록 새로고침
                refreshFileList();
            } catch (e) {
                console.error('응답 파싱 오류:', e);
                showMessage('일부 파일 업로드에 실패했습니다.', 'warning');
            }
        } else {
            // 오류 처리
            try {
                const response = JSON.parse(xhr.responseText);
                const errorMsg = response.error || `업로드 실패 (${xhr.status})`;
                showMessage(errorMsg, 'error');
                console.error('업로드 오류:', response);
            } catch (e) {
                showMessage(`업로드 오류: ${xhr.status} ${xhr.statusText}`, 'error');
                console.error('업로드 오류 응답:', xhr.responseText);
            }
        }
        
        // 프로그레스 바 제거
        removeProgressBar();
    };
    
    // 네트워크 오류 처리
    xhr.onerror = function() {
        updateUploadStatus(false);
        removeProgressBar();
        showMessage('네트워크 오류로 업로드에 실패했습니다.', 'error');
        console.error('네트워크 오류:', xhr);
    };
    
    // 전송 취소 처리
    xhr.onabort = function() {
        updateUploadStatus(false);
        removeProgressBar();
        showMessage('업로드가 취소되었습니다.', 'warning');
        console.warn('업로드 취소됨');
    };
    
    // 요청 전송
    try {
        console.log(`총 ${files.length}개 파일 업로드 요청 시작`);
        xhr.send(formData);
    } catch (e) {
        updateUploadStatus(false);
        removeProgressBar();
        showMessage('업로드 요청 전송 중 오류가 발생했습니다.', 'error');
        console.error('전송 오류:', e);
    }
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
        folderNameInput.value = '';
        folderModal.style.display = 'flex';
        folderNameInput.focus();
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
    // 파일 업로드 처리
    fileUploadInput.addEventListener('change', (e) => {
        // 파일 크기 제한 알림
        const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB
        const files = e.target.files;
        
        // 업로드 소스 설정 및 카운터 초기화
        uploadSource = 'button';
        uploadButtonCounter = 0;
        
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > maxFileSize) {
                alert(`파일 크기가 너무 큽니다: ${files[i].name} (${formatFileSize(files[i].size)})
최대 파일 크기: 10GB`);
                // 파일 입력 초기화
                e.target.value = '';
                return;
            }
        }
        
        uploadFiles(e.target.files);
        // 파일 입력 초기화
        e.target.value = '';
    });
    
    // 폴더 업로드 처리
    const folderUploadInput = document.getElementById('folderUpload');
    if (folderUploadInput) {
        folderUploadInput.addEventListener('change', (e) => {
            const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB
            const files = e.target.files;
            
            // 업로드 소스 설정 및 카운터 초기화
            uploadSource = 'button';
            uploadButtonCounter = 0;
            
            // 파일 크기 체크
            for (let i = 0; i < files.length; i++) {
                if (files[i].size > maxFileSize) {
                    alert(`파일 크기가 너무 큽니다: ${files[i].name} (${formatFileSize(files[i].size)})
최대 파일 크기: 10GB`);
                    // 파일 입력 초기화
                    e.target.value = '';
                    return;
                }
            }
            
            // 폴더 업로드 시작
            if (files.length > 0) {
                console.log(`폴더 업로드: ${files.length}개 파일`);
                statusInfo.textContent = `폴더 업로드: ${files.length}개 파일`;
                uploadFiles(files);
            }
            
            // 파일 입력 초기화
            e.target.value = '';
        });
    }
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
        const isFolder = document.querySelector(`.file-item[data-id="${itemId}"]`).getAttribute('data-is-folder') === 'true';
        
        // 폴더인 경우 무시
        if (isFolder) {
            alert('폴더는 다운로드할 수 없습니다.');
            return;
        }
        
        // 파일 경로 생성
        const filePath = currentPath ? `${currentPath}/${itemId}` : itemId;
        const encodedPath = encodeURIComponent(filePath);
        const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
        
        // 강제로 다운로드 진행
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', itemId); // 다운로드 속성 추가
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        statusInfo.textContent = `${itemId} 다운로드 중...`;
        setTimeout(() => {
            statusInfo.textContent = `${itemId} 다운로드 완료`;
        }, 1000);
        
        return;
    }
    
    // 여러 파일 선택 시 각 파일을 개별적으로 다운로드
    showLoading();
    statusInfo.textContent = '다운로드 준비 중...';
    
    // 현재 선택된 모든 항목을 다운로드 큐에 추가
    const downloadQueue = [];
    selectedItems.forEach(itemId => {
        const element = document.querySelector(`.file-item[data-id="${itemId}"]`);
        const isFolder = element.getAttribute('data-is-folder') === 'true';
        
        // 폴더는 제외 (서버에서 지원하지 않는 경우)
        if (!isFolder) {
            downloadQueue.push(itemId);
        }
    });
    
    // 다운로드 큐가 비어있으면 종료
    if (downloadQueue.length === 0) {
        alert('다운로드할 파일이 없습니다. 폴더는 다운로드할 수 없습니다.');
        hideLoading();
        return;
    }
    
    // 동시에 여러 파일 다운로드 시작
    downloadQueue.forEach(fileName => {
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
        const encodedPath = encodeURIComponent(filePath);
        const downloadUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
        
        // 링크 생성 및 클릭 이벤트 발생 (download 속성 명시)
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', fileName); // 다운로드 속성 설정
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    // 다운로드 완료 처리
    setTimeout(() => {
        hideLoading();
        statusInfo.textContent = `${downloadQueue.length}개 파일 다운로드 시작됨`;
    }, 1000);
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
        
        // a 태그를 생성하여 다운로드 속성 설정
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 다운로드 속성
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            statusInfo.textContent = `${fileName} 다운로드 완료됨. 파일을 실행하세요.`;
        }, 1000);
    } 
    // 브라우저에서 볼 수 있는 파일인 경우
    else if (viewableTypes.includes(fileExt)) {
        // 새 창에서 열기
        window.open(fileUrl, '_blank');
        statusInfo.textContent = `${fileName} 파일 열기`;
    } 
    // 그 외 파일은 단순 다운로드
    else {
        // a 태그를 생성하여 다운로드 속성 설정
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName); // 다운로드 속성
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        statusInfo.textContent = `${fileName} 다운로드 중...`;
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

// 폴더 항목 재귀적 처리 함수
function processEntries(entries) {
    const allFiles = [];
    let pendingEntries = entries.length;
    
    if (pendingEntries === 0) {
        console.log('처리할 항목이 없습니다.');
        hideLoading();
        return;
    }
    
    showLoading();
    console.log(`총 ${pendingEntries}개 항목 처리 시작`);
    statusInfo.textContent = `${pendingEntries}개 항목 스캔 중...`;
    
    // 재귀적으로 폴더 내용을 읽는 함수
    function readAllEntries(reader, cb) {
        let entries = [];
        
        // 폴더의 내용을 모두 읽을 때까지 반복
        function readNext() {
            reader.readEntries(function(results) {
                if (results.length) {
                    entries = entries.concat(Array.from(results));
                    readNext();
                } else {
                    cb(entries);
                }
            }, function(error) {
                console.error('항목 읽기 오류:', error);
                cb(entries);
            });
        }
        
        readNext();
    }
    
    // 전체 처리가 완료되었는지 확인하는 함수
    function checkComplete() {
        pendingEntries--;
        if (pendingEntries <= 0) {
            finishProcessing();
        }
    }
    
    // 처리 완료 함수
    function finishProcessing() {
        console.log(`총 ${allFiles.length}개 파일 처리 완료, 업로드 시작`);
        
        if (allFiles.length > 0) {
            statusInfo.textContent = `총 ${allFiles.length}개 파일 처리 완료, 업로드 시작...`;
            uploadFiles(allFiles);
        } else {
            statusInfo.textContent = '업로드할 파일이 없습니다.';
            hideLoading();
        }
    }
    
    // 각 항목을 재귀적으로 처리하는 함수
    function processEntry(entry) {
        if (!entry) {
            console.error('처리할 수 없는 항목:', entry);
            checkComplete();
            return;
        }
        
        console.log(`항목 처리: ${entry.fullPath}, 타입: ${entry.isFile ? '파일' : '폴더'}`);
        
        if (entry.isFile) {
            // 파일 처리
            entry.file(function(file) {
                try {
                    // 파일 가공 및 처리
                    // WebkitRelativePath 속성을 entry.fullPath로 설정
                    const relativePath = entry.fullPath.substring(1); // 첫 번째 '/'는 제외
                    
                    // 디버그 로깅
                    console.log(`File: ${file.name}`);
                    console.log(`Path: ${relativePath}`);
                    
                    // File 객체에 webkitRelativePath 속성 추가
                    Object.defineProperty(file, 'webkitRelativePath', {
                        writable: true,
                        value: relativePath
                    });
                    
                    // 디버그 확인
                    console.log(`속성 설정 확인: ${file.webkitRelativePath}`);
                    
                    allFiles.push(file);
                    statusInfo.textContent = `${allFiles.length}개 파일 발견, ${pendingEntries}개 항목 남음...`;
                    checkComplete();
                } catch (e) {
                    console.error('파일 객체 처리 오류:', e);
                    checkComplete();
                }
            }, function(error) {
                console.error('파일 읽기 오류:', error);
                checkComplete();
            });
        } else if (entry.isDirectory) {
            // 폴더 처리
            console.log(`폴더 읽기: ${entry.fullPath}`);
            
            try {
                const reader = entry.createReader();
                
                // 폴더의 모든 항목을 한 번에 읽기
                readAllEntries(reader, function(entries) {
                    console.log(`폴더 ${entry.fullPath}에서 ${entries.length}개 항목 발견`);
                    
                    // 하위 항목이 있으면 처리 대기 항목에 추가
                    if (entries.length > 0) {
                        pendingEntries += entries.length;
                        statusInfo.textContent = `폴더 '${entry.name}' 스캔 중... ${pendingEntries}개 항목 남음`;
                        
                        // 각 하위 항목 처리
                        entries.forEach(function(childEntry) {
                            processEntry(childEntry);
                        });
                    }
                    
                    // 현재 폴더 처리 완료
                    checkComplete();
                });
            } catch (e) {
                console.error('폴더 처리 오류:', e);
                checkComplete();
            }
        } else {
            // 알 수 없는 유형
            console.warn('알 수 없는 항목 유형:', entry);
            checkComplete();
        }
    }
    
    // 각 항목 처리 시작
    entries.forEach(function(entry) {
        processEntry(entry);
    });
}
