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
    const itemId = item.getAttribute('data-id');
    
    if (!addToSelection) {
        clearSelection();
    }
    
    item.classList.add('selected');
    selectedItems.add(itemId);
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
        if (selectedItem && selectedItem.getAttribute('data-is-folder') === 'true') {
            navigateToFolder(selectedItem.getAttribute('data-name'));
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
}

// 드래그 선택 초기화
function initDragSelection() {
    let isSelecting = false;
    
    fileList.addEventListener('mousedown', (e) => {
        // 왼쪽 버튼만 처리
        if (e.button !== 0) return;
        
        // 빈 공간에서만 드래그 선택 시작
        // 파일 아이템에서는 드래그 선택 시작하지 않음
        if (e.target === fileList || e.target === fileView) {
            // 실제 파일 아이템이나 그 자식 요소를 클릭한 경우는 제외
            if (e.target.closest('.file-item')) return;
            
            isSelecting = true;
            
            // 정확한 클릭 위치 계산
            const rect = fileList.getBoundingClientRect();
            startX = e.clientX - rect.left + fileList.scrollLeft;
            startY = e.clientY - rect.top + fileList.scrollTop;
            
            // Ctrl 키가 눌려있지 않으면 기존 선택 해제
            if (!e.ctrlKey) {
                clearSelection();
            }
            
            // 선택 상자 초기화
            selectionBox.style.display = 'block';
            selectionBox.style.left = `${startX}px`;
            selectionBox.style.top = `${startY}px`;
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        
        // 정확한 현재 마우스 위치 계산
        const rect = fileList.getBoundingClientRect();
        const currentX = e.clientX - rect.left + fileList.scrollLeft;
        const currentY = e.clientY - rect.top + fileList.scrollTop;
        
        // 선택 상자 업데이트
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        
        selectionBox.style.left = `${x}px`;
        selectionBox.style.top = `${y}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
        
        // 자동 스크롤 기능
        const buffer = 50; // 화면 가장자리로부터의 거리
        const scrollSpeed = 15; // 스크롤 속도
        
        // 하단 스크롤
        if (e.clientY > rect.bottom - buffer) {
            fileList.scrollTop += scrollSpeed;
        }
        // 상단 스크롤
        else if (e.clientY < rect.top + buffer) {
            fileList.scrollTop -= scrollSpeed;
        }
        
        // 선택 상자와 겹치는 항목 선택
        const selectionRect = {
            left: x,
            top: y,
            right: x + width,
            bottom: y + height
        };
        
        document.querySelectorAll('.file-item').forEach(item => {
            const itemRect = item.getBoundingClientRect();
            const itemRectAdjusted = {
                left: itemRect.left - rect.left + fileList.scrollLeft,
                top: itemRect.top - rect.top + fileList.scrollTop,
                right: itemRect.right - rect.left + fileList.scrollLeft,
                bottom: itemRect.bottom - rect.top + fileList.scrollTop
            };
            
            // 겹침 확인
            if (!(itemRectAdjusted.right < selectionRect.left || 
                  itemRectAdjusted.left > selectionRect.right || 
                  itemRectAdjusted.bottom < selectionRect.top || 
                  itemRectAdjusted.top > selectionRect.bottom)) {
                item.classList.add('selected');
                selectedItems.add(item.getAttribute('data-id'));
            } else if (!e.ctrlKey) {
                item.classList.remove('selected');
                selectedItems.delete(item.getAttribute('data-id'));
            }
        });
        
        updateButtonStates();
    });
    
    document.addEventListener('mouseup', () => {
        if (isSelecting) {
            isSelecting = false;
            selectionBox.style.display = 'none';
        }
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
function loadFiles(path) {
    showLoading();
    statusInfo.textContent = '파일 로드 중...';
    
    // 경로에 한글이 포함된 경우를 위해 인코딩 처리
    const encodedPath = path ? encodeURIComponent(path) : '';
    
    // 디스크 사용량 가져오기
    loadDiskUsage();
    
    fetch(`${API_BASE_URL}/api/files/${encodedPath}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('파일 목록을 가져오는데 실패했습니다.');
            }
            return response.json();
        })
        .then(data => {
            // 정렬 적용
            const sortedData = sortFiles(data);
            renderFileList(sortedData);
            updateBreadcrumb(path);
            hideLoading();
            statusInfo.textContent = `${data.length}개 항목`;
        })
        .catch(error => {
            console.error('Error:', error);
            fileView.innerHTML = `<div class="error-message">오류가 발생했습니다: ${error.message}</div>`;
            hideLoading();
            statusInfo.textContent = '오류 발생';
        });
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
function renderFileList(files) {
    fileView.innerHTML = '';
    
    // 목록 보기 모드일 때 헤더 추가
    if (listView) {
        const headerRow = document.createElement('div');
        headerRow.className = 'file-list-header';
        headerRow.style.position = 'sticky';
        headerRow.style.top = '0';
        headerRow.style.backgroundColor = 'var(--background-color)';
        headerRow.style.zIndex = '10';
        headerRow.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
        headerRow.style.padding = '10px 0';
        headerRow.innerHTML = `
            <div class="header-item header-icon"></div>
            <div class="header-item header-name" data-sort="name">이름 ${getSortIcon('name')}</div>
            <div class="header-item header-size" data-sort="size">크기 ${getSortIcon('size')}</div>
            <div class="header-item header-date" data-sort="date">수정된 날짜 ${getSortIcon('date')}</div>
        `;
        
        // 헤더 클릭 이벤트 추가
        headerRow.querySelectorAll('.header-item[data-sort]').forEach(header => {
            header.addEventListener('click', () => {
                const field = header.getAttribute('data-sort');
                if (sortField === field) {
                    // 같은 필드면 방향 전환
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    // 다른 필드면 새 필드로 변경하고 오름차순 시작
                    sortField = field;
                    sortDirection = 'asc';
                }
                
                // 현재 폴더 다시 로드 (정렬 적용)
                loadFiles(currentPath);
            });
        });
        
        fileView.appendChild(headerRow);
        
        // 목록 보기 클래스 추가
        fileView.classList.add('list-view');
    } else {
        // 목록 보기 클래스 제거
        fileView.classList.remove('list-view');
    }
    
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.setAttribute('data-id', file.name);
        fileItem.setAttribute('data-name', file.name);
        fileItem.setAttribute('data-is-folder', file.isFolder);
        fileItem.setAttribute('data-size', file.size);
        fileItem.setAttribute('data-date', file.modifiedTime);
        
        const iconClass = file.isFolder 
            ? 'fas fa-folder' 
            : getFileIconClass(file.name);
        
        fileItem.innerHTML = `
            <div class="file-icon"><i class="${iconClass}"></i></div>
            <div class="file-name">${file.name}</div>
            <input type="text" class="rename-input" value="${file.name}">
            <div class="file-details">
                <span class="file-size">${formatFileSize(file.size)}</span>
                <span class="file-date">${formatDate(file.modifiedTime)}</span>
            </div>
        `;
        
        // 이벤트 리스너 추가
        fileItem.addEventListener('click', (e) => handleFileClick(e, fileItem));
        fileItem.addEventListener('dblclick', (e) => handleFileDblClick(e, fileItem));
        
        // 드래그 이벤트 처리
        fileItem.setAttribute('draggable', 'true');
        fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
        fileItem.addEventListener('dragend', handleDragEnd);
        
        // 폴더인 경우 드롭 영역으로 설정
        if (file.isFolder) {
            window.addFolderDragEvents(fileItem);
        }
        
        fileView.appendChild(fileItem);
    });
    
    // 선택 초기화
    clearSelection();
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
                selectedItems.add(items[i].getAttribute('data-id'));
            }
        }
    } else {
        // 일반 클릭
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
    loadFiles(newPath);
    
    // 선택 초기화
    clearSelection();
}

// 파일 다운로드
function downloadFile(fileName) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    // 경로에 한글이 포함된 경우를 위해 인코딩 처리
    const encodedPath = encodeURIComponent(filePath);
    window.location.href = `${API_BASE_URL}/api/files/${encodedPath}`;
}

// 모든 항목 선택
function selectAllItems() {
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.add('selected');
        selectedItems.add(item.getAttribute('data-id'));
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
    
    const itemsText = selectedItems.size > 1 
        ? `${selectedItems.size}개 항목` 
        : document.querySelector('.file-item.selected').getAttribute('data-name');
    
    if (confirm(`정말 ${itemsText}을(를) 삭제하시겠습니까?`)) {
        // 선택된 모든 항목 삭제
        const promises = [];
        
        selectedItems.forEach(itemId => {
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
    
    // 현재 선택된 항목을 클립보드에 복사
    selectedItems.forEach(itemId => {
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
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 드래그 데이터 설정
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', [...selectedItems].join(','));
    
    isDragging = true;
}

// 드래그 종료 처리
function handleDragEnd() {
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    // 드롭 영역 처리
    fileList.addEventListener('dragenter', () => {
        if (isDragging) return; // 내부 드래그는 무시
        dropZone.classList.add('active');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        // 내부 요소로의 이벤트 전파는 무시
        if (e.relatedTarget && dropZone.contains(e.relatedTarget)) return;
        dropZone.classList.remove('active');
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        
        if (isDragging) {
            // 내부 드래그 앤 드롭 처리
            const draggedItems = e.dataTransfer.getData('text/plain').split(',');
            moveItems(draggedItems);
        } else {
            // 외부 파일 업로드 처리
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadFiles(files);
            }
        }
    });
    
    // 폴더 아이템에 드래그 앤 드롭 이벤트 추가
    const handleFolderDragOver = (e) => {
        e.preventDefault();
        
        // 자기 자신으로의 드래그는 무시 (폴더를 자신 위에 드래그)
        if (selectedItems.has(e.currentTarget.getAttribute('data-name'))) {
            return;
        }
        
        // 드래그 오버 효과 추가
        e.currentTarget.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    };
    
    const handleFolderDragLeave = (e) => {
        // 내부 요소로의 이벤트 전파는 무시
        if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
        e.currentTarget.classList.remove('drag-over');
    };
    
    const handleFolderDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        // 자기 자신으로의 드롭은 무시
        if (selectedItems.has(e.currentTarget.getAttribute('data-name'))) {
            return;
        }
        
        // 내부 드래그 앤 드롭 처리
        const draggedItems = e.dataTransfer.getData('text/plain').split(',');
        const targetFolder = e.currentTarget.getAttribute('data-name');
        
        // 선택된 항목을 타겟 폴더로 이동
        moveItemsToFolder(draggedItems, targetFolder);
    };
    
    // 폴더 아이템에 이벤트 핸들러 등록 함수 (동적으로 생성된 요소에 적용하기 위함)
    window.addFolderDragEvents = (folderItem) => {
        folderItem.addEventListener('dragover', handleFolderDragOver);
        folderItem.addEventListener('dragleave', handleFolderDragLeave);
        folderItem.addEventListener('drop', handleFolderDrop);
    };
}

// 폴더 항목을 다른 폴더로 이동
function moveItemsToFolder(itemIds, targetFolder) {
    if (!Array.isArray(itemIds) || itemIds.length === 0 || !targetFolder) return;
    
    const promises = [];
    showLoading();
    statusInfo.textContent = '파일 이동 중...';
    
    itemIds.forEach(itemId => {
        // 소스 경로
        const sourcePath = currentPath ? `${currentPath}/${itemId}` : itemId;
        // 타겟 경로
        const targetPath = currentPath ? `${currentPath}/${targetFolder}` : targetFolder;
        
        console.log(`드래그로 이동: ${sourcePath} -> ${targetPath}/${itemId}, 현재경로=${currentPath}`);
        
        // 경로에 한글이 포함된 경우를 위해 인코딩 처리
        const encodedPath = encodeURIComponent(sourcePath);
        
        promises.push(
            fetch(`${API_BASE_URL}/api/files/${encodedPath}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    newName: itemId,
                    targetPath: targetPath
                })
            })
            .then(response => {
                if (!response.ok) {
                    // 응답 텍스트를 추출하여 오류 메시지로 사용
                    return response.text().then(text => {
                        throw new Error(text || `${itemId} 이동 실패 (${response.status})`);
                    });
                }
                return itemId;
            })
        );
    });
    
    Promise.all(promises)
        .then(() => {
            loadFiles(currentPath); // 파일 목록 새로고침
            statusInfo.textContent = `${promises.length}개 항목 이동됨`;
            hideLoading();
        })
        .catch(error => {
            alert(`오류 발생: ${error.message}`);
            hideLoading();
            loadFiles(currentPath);
        });
}

// 파일 업로드
function uploadFiles(files) {
    if (files.length === 0) return;
    
    // 업로드 UI 표시
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    
    // 전체 파일 크기와 현재까지 업로드된 크기를 추적
    const totalFiles = files.length;
    let currentFileIndex = 0;
    let totalSize = 0;
    let uploadedTotalSize = 0;
    
    // 전체 파일 크기 계산
    for (let i = 0; i < files.length; i++) {
        totalSize += files[i].size;
    }
    
    // 시작 시간 기록
    const startTime = new Date().getTime();
    
    // 파일을 순차적으로 업로드
    const uploadNextFile = (index) => {
        if (index >= files.length) {
            // 모든 파일 업로드 완료
            progressContainer.style.display = 'none';
            loadFiles(currentPath); // 파일 목록 새로고침
            statusInfo.textContent = '모든 파일 업로드 완료';
            return;
        }
        
        const file = files[index];
        const fileName = file.name;
        currentFileIndex = index + 1;
        
        // 현재 파일 정보 업데이트
        document.getElementById('currentFileUpload').textContent = `${fileName} (${currentFileIndex}/${totalFiles})`;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);
        
        // 이전 파일들의 크기
        let previousFilesSize = 0;
        for (let i = 0; i < index; i++) {
            previousFilesSize += files[i].size;
        }
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/api/upload`);
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                // 현재 파일 업로드 진행률
                const currentFileProgress = (e.loaded / e.total) * 100;
                
                // 전체 업로드 진행률 계산
                const totalUploaded = previousFilesSize + e.loaded;
                const totalProgress = (totalUploaded / totalSize) * 100;
                
                // 업로드 속도 및 남은 시간 계산
                const currentTime = new Date().getTime();
                const elapsedTimeSeconds = (currentTime - startTime) / 1000;
                const uploadedBytes = totalUploaded;
                const uploadSpeed = uploadedBytes / elapsedTimeSeconds; // bytes per second
                
                let remainingTime = (totalSize - totalUploaded) / uploadSpeed; // 남은 시간(초)
                let timeDisplay;
                
                if (remainingTime < 60) {
                    timeDisplay = `${Math.round(remainingTime)}초`;
                } else if (remainingTime < 3600) {
                    timeDisplay = `${Math.floor(remainingTime / 60)}분 ${Math.round(remainingTime % 60)}초`;
                } else {
                    timeDisplay = `${Math.floor(remainingTime / 3600)}시간 ${Math.floor((remainingTime % 3600) / 60)}분`;
                }
                
                // 진행률 표시 업데이트
                progressBar.style.width = `${totalProgress}%`;
                uploadStatus.textContent = `${currentFileIndex}/${totalFiles} 파일 업로드 중 - ${Math.round(totalProgress)}% 완료 (남은 시간: ${timeDisplay})`;
                
                // 현재 파일 진행 상태 업데이트
                statusInfo.textContent = `${fileName} 업로드 중 (${Math.round(currentFileProgress)}%)`;
            }
        };
        
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 201) {
                    // 현재 파일 업로드 성공, 다음 파일로 진행
                    uploadedTotalSize += file.size;
                    uploadNextFile(index + 1);
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
                    
                    // 계속해서 다음 파일 업로드
                    uploadNextFile(index + 1);
                }
            }
        };
        
        xhr.onerror = () => {
            uploadStatus.textContent = `${fileName} 업로드 실패: 네트워크 오류`;
            statusInfo.textContent = `${fileName} 업로드 실패: 네트워크 오류`;
            uploadNextFile(index + 1);
        };
        
        xhr.send(formData);
    };
    
    // 첫 번째 파일부터 업로드 시작
    uploadNextFile(0);
}

// 뷰 모드 전환
function initViewModes() {
    // 초기 UI 설정 (목록 보기)
    listViewBtn.classList.add('active');
    gridViewBtn.classList.remove('active');
    listView = true;

    gridViewBtn.addEventListener('click', () => {
        listView = false;
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        
        // 현재 폴더 다시 로드
        loadFiles(currentPath);
    });
    
    listViewBtn.addEventListener('click', () => {
        listView = true;
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        
        // 현재 폴더 다시 로드
        loadFiles(currentPath);
    });
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
    fileUploadInput.addEventListener('change', (e) => {
        // 파일 크기 제한 알림
        const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB
        const files = e.target.files;
        
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
        downloadFile(itemId);
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
        
        // 링크 생성 및 클릭 이벤트 발생
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName; // 다운로드 파일명 설정
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
    
    // 클립보드에 추가
    clipboardItems = [];
    itemIds.forEach(id => {
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

// 애플리케이션 초기화
function init() {
    // 기본 기능 초기화
    initModals();
    initContextMenu();
    initDragSelection();
    initDragAndDrop();
    initShortcuts();
    initViewModes();
    
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
