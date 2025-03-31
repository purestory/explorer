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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
                    `${conflictItems.length}개 파일이 이미 존재합니다. 모두 덮어쓰시겠습니까?\n` +
                    `덮어쓸 파일: ${conflictItems.map(item => item.name).join(', ')}`
                );
                overwriteAll = overwriteConfirm;
            }
            
            // 모든 파일 이동 동시에 처리
            const movePromises = draggedItems.map(item => {
                const itemPath = item.path;
                const fileName = item.name;
                const sourcePath = `${itemPath}/${fileName}`;
                
                // 파일이 이미 존재하는지 여부
                const isConflict = currentFileNames.includes(fileName);
                
                // 충돌 여부에 따라 overwrite 옵션 적용
                return moveItem(sourcePath, currentPath, isConflict ? overwriteAll : false)
                    .catch(error => {
                        console.error(`${fileName} 이동 중 오류:`, error);
                        // Promise.allSettled에서 사용하기 위해 실패 결과 객체 반환
                        return {
                            status: 'rejected',
                            fileName: fileName,
                            error: error
                        };
                    });
            });
            
            // 모든 이동 작업 완료 대기
            const results = await Promise.allSettled(movePromises);
            
            // 결과 집계
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'rejected').length;
            const failed = results.filter(r => r.status === 'rejected' || r.value?.status === 'rejected').length;
            const skipped = results.filter(r => r.value?.status === 'skipped').length;
            
            // 실패한 작업이 있으면 오류 메시지 표시
            if (failed > 0) {
                const failedItems = results
                    .filter(r => r.status === 'rejected' || r.value?.status === 'rejected')
                    .map(r => {
                        if (r.status === 'rejected') {
                            return r.reason?.fileName || '알 수 없는 파일';
                        } else {
                            return r.value?.fileName || '알 수 없는 파일';
                        }
                    });
                
                alert(`${succeeded}개 이동 성공, ${failed}개 실패, ${skipped}개 생략됨.\n실패한 항목: ${failedItems.join(', ')}`);
            } else if (skipped > 0) {
                alert(`${succeeded}개 이동 성공, ${skipped}개 생략됨.`);
            } else {
                alert(`${succeeded}개 항목이 이동되었습니다.`);
            }
            
            // 파일 목록 새로고침
            loadFiles(currentPath);
        } catch (error) {
            console.error('파일 이동 중 오류:', error);
            alert('파일 이동 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
    
    // 파일 업로드 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        // 외부 파일 업로드인 경우만 드롭존 표시
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('active');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('active');
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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
                    `${conflictItems.length}개 파일이 이미 존재합니다. 모두 덮어쓰시겠습니까?\n` +
                    `덮어쓸 파일: ${conflictItems.map(item => item.name).join(', ')}`
                );
                overwriteAll = overwriteConfirm;
            }
            
            // 모든 파일 이동 동시에 처리
            const movePromises = draggedItems.map(item => {
                const itemPath = item.path;
                const fileName = item.name;
                const sourcePath = `${itemPath}/${fileName}`;
                
                // 파일이 이미 존재하는지 여부
                const isConflict = currentFileNames.includes(fileName);
                
                // 충돌 여부에 따라 overwrite 옵션 적용
                return moveItem(sourcePath, currentPath, isConflict ? overwriteAll : false)
                    .catch(error => {
                        console.error(`${fileName} 이동 중 오류:`, error);
                        // Promise.allSettled에서 사용하기 위해 실패 결과 객체 반환
                        return {
                            status: 'rejected',
                            fileName: fileName,
                            error: error
                        };
                    });
            });
            
            // 모든 이동 작업 완료 대기
            const results = await Promise.allSettled(movePromises);
            
            // 결과 집계
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'rejected').length;
            const failed = results.filter(r => r.status === 'rejected' || r.value?.status === 'rejected').length;
            const skipped = results.filter(r => r.value?.status === 'skipped').length;
            
            // 실패한 작업이 있으면 오류 메시지 표시
            if (failed > 0) {
                const failedItems = results
                    .filter(r => r.status === 'rejected' || r.value?.status === 'rejected')
                    .map(r => {
                        if (r.status === 'rejected') {
                            return r.reason?.fileName || '알 수 없는 파일';
                        } else {
                            return r.value?.fileName || '알 수 없는 파일';
                        }
                    });
                
                alert(`${succeeded}개 이동 성공, ${failed}개 실패, ${skipped}개 생략됨.\n실패한 항목: ${failedItems.join(', ')}`);
            } else if (skipped > 0) {
                alert(`${succeeded}개 이동 성공, ${skipped}개 생략됨.`);
            } else {
                alert(`${succeeded}개 항목이 이동되었습니다.`);
            }
            
            // 파일 목록 새로고침
            loadFiles(currentPath);
        } catch (error) {
            console.error('파일 이동 중 오류:', error);
            alert('파일 이동 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
    
    // 파일 업로드 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        // 외부 파일 업로드인 경우만 드롭존 표시
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('active');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('active');
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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
                    `${conflictItems.length}개 파일이 이미 존재합니다. 모두 덮어쓰시겠습니까?\n` +
                    `덮어쓸 파일: ${conflictItems.map(item => item.name).join(', ')}`
                );
                overwriteAll = overwriteConfirm;
            }
            
            // 모든 파일 이동 동시에 처리
            const movePromises = draggedItems.map(item => {
                const itemPath = item.path;
                const fileName = item.name;
                const sourcePath = `${itemPath}/${fileName}`;
                
                // 파일이 이미 존재하는지 여부
                const isConflict = currentFileNames.includes(fileName);
                
                // 충돌 여부에 따라 overwrite 옵션 적용
                return moveItem(sourcePath, currentPath, isConflict ? overwriteAll : false)
                    .catch(error => {
                        console.error(`${fileName} 이동 중 오류:`, error);
                        // Promise.allSettled에서 사용하기 위해 실패 결과 객체 반환
                        return {
                            status: 'rejected',
                            fileName: fileName,
                            error: error
                        };
                    });
            });
            
            // 모든 이동 작업 완료 대기
            const results = await Promise.allSettled(movePromises);
            
            // 결과 집계
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'rejected').length;
            const failed = results.filter(r => r.status === 'rejected' || r.value?.status === 'rejected').length;
            const skipped = results.filter(r => r.value?.status === 'skipped').length;
            
            // 실패한 작업이 있으면 오류 메시지 표시
            if (failed > 0) {
                const failedItems = results
                    .filter(r => r.status === 'rejected' || r.value?.status === 'rejected')
                    .map(r => {
                        if (r.status === 'rejected') {
                            return r.reason?.fileName || '알 수 없는 파일';
                        } else {
                            return r.value?.fileName || '알 수 없는 파일';
                        }
                    });
                
                alert(`${succeeded}개 이동 성공, ${failed}개 실패, ${skipped}개 생략됨.\n실패한 항목: ${failedItems.join(', ')}`);
            } else if (skipped > 0) {
                alert(`${succeeded}개 이동 성공, ${skipped}개 생략됨.`);
            } else {
                alert(`${succeeded}개 항목이 이동되었습니다.`);
            }
            
            // 파일 목록 새로고침
            loadFiles(currentPath);
        } catch (error) {
            console.error('파일 이동 중 오류:', error);
            alert('파일 이동 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
    
    // 파일 업로드 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        // 외부 파일 업로드인 경우만 드롭존 표시
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('active');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('active');
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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
                    `${conflictItems.length}개 파일이 이미 존재합니다. 모두 덮어쓰시겠습니까?\n` +
                    `덮어쓸 파일: ${conflictItems.map(item => item.name).join(', ')}`
                );
                overwriteAll = overwriteConfirm;
            }
            
            // 모든 파일 이동 동시에 처리
            const movePromises = draggedItems.map(item => {
                const itemPath = item.path;
                const fileName = item.name;
                const sourcePath = `${itemPath}/${fileName}`;
                
                // 파일이 이미 존재하는지 여부
                const isConflict = currentFileNames.includes(fileName);
                
                // 충돌 여부에 따라 overwrite 옵션 적용
                return moveItem(sourcePath, currentPath, isConflict ? overwriteAll : false)
                    .catch(error => {
                        console.error(`${fileName} 이동 중 오류:`, error);
                        // Promise.allSettled에서 사용하기 위해 실패 결과 객체 반환
                        return {
                            status: 'rejected',
                            fileName: fileName,
                            error: error
                        };
                    });
            });
            
            // 모든 이동 작업 완료 대기
            const results = await Promise.allSettled(movePromises);
            
            // 결과 집계
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'rejected').length;
            const failed = results.filter(r => r.status === 'rejected' || r.value?.status === 'rejected').length;
            const skipped = results.filter(r => r.value?.status === 'skipped').length;
            
            // 실패한 작업이 있으면 오류 메시지 표시
            if (failed > 0) {
                const failedItems = results
                    .filter(r => r.status === 'rejected' || r.value?.status === 'rejected')
                    .map(r => {
                        if (r.status === 'rejected') {
                            return r.reason?.fileName || '알 수 없는 파일';
                        } else {
                            return r.value?.fileName || '알 수 없는 파일';
                        }
                    });
                
                alert(`${succeeded}개 이동 성공, ${failed}개 실패, ${skipped}개 생략됨.\n실패한 항목: ${failedItems.join(', ')}`);
            } else if (skipped > 0) {
                alert(`${succeeded}개 이동 성공, ${skipped}개 생략됨.`);
            } else {
                alert(`${succeeded}개 항목이 이동되었습니다.`);
            }
            
            // 파일 목록 새로고침
            loadFiles(currentPath);
        } catch (error) {
            console.error('파일 이동 중 오류:', error);
            alert('파일 이동 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
    
    // 파일 업로드 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        // 외부 파일 업로드인 경우만 드롭존 표시
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('active');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('active');
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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
                    `${conflictItems.length}개 파일이 이미 존재합니다. 모두 덮어쓰시겠습니까?\n` +
                    `덮어쓸 파일: ${conflictItems.map(item => item.name).join(', ')}`
                );
                overwriteAll = overwriteConfirm;
            }
            
            // 모든 파일 이동 동시에 처리
            const movePromises = draggedItems.map(item => {
                const itemPath = item.path;
                const fileName = item.name;
                const sourcePath = `${itemPath}/${fileName}`;
                
                // 파일이 이미 존재하는지 여부
                const isConflict = currentFileNames.includes(fileName);
                
                // 충돌 여부에 따라 overwrite 옵션 적용
                return moveItem(sourcePath, currentPath, isConflict ? overwriteAll : false)
                    .catch(error => {
                        console.error(`${fileName} 이동 중 오류:`, error);
                        // Promise.allSettled에서 사용하기 위해 실패 결과 객체 반환
                        return {
                            status: 'rejected',
                            fileName: fileName,
                            error: error
                        };
                    });
            });
            
            // 모든 이동 작업 완료 대기
            const results = await Promise.allSettled(movePromises);
            
            // 결과 집계
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'rejected').length;
            const failed = results.filter(r => r.status === 'rejected' || r.value?.status === 'rejected').length;
            const skipped = results.filter(r => r.value?.status === 'skipped').length;
            
            // 실패한 작업이 있으면 오류 메시지 표시
            if (failed > 0) {
                const failedItems = results
                    .filter(r => r.status === 'rejected' || r.value?.status === 'rejected')
                    .map(r => {
                        if (r.status === 'rejected') {
                            return r.reason?.fileName || '알 수 없는 파일';
                        } else {
                            return r.value?.fileName || '알 수 없는 파일';
                        }
                    });
                
                alert(`${succeeded}개 이동 성공, ${failed}개 실패, ${skipped}개 생략됨.\n실패한 항목: ${failedItems.join(', ')}`);
            } else if (skipped > 0) {
                alert(`${succeeded}개 이동 성공, ${skipped}개 생략됨.`);
            } else {
                alert(`${succeeded}개 항목이 이동되었습니다.`);
            }
            
            // 파일 목록 새로고침
            loadFiles(currentPath);
        } catch (error) {
            console.error('파일 이동 중 오류:', error);
            alert('파일 이동 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
    
    // 파일 업로드 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        // 외부 파일 업로드인 경우만 드롭존 표시
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('active');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('active');
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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
                    `${conflictItems.length}개 파일이 이미 존재합니다. 모두 덮어쓰시겠습니까?\n` +
                    `덮어쓸 파일: ${conflictItems.map(item => item.name).join(', ')}`
                );
                overwriteAll = overwriteConfirm;
            }
            
            // 모든 파일 이동 동시에 처리
            const movePromises = draggedItems.map(item => {
                const itemPath = item.path;
                const fileName = item.name;
                const sourcePath = `${itemPath}/${fileName}`;
                
                // 파일이 이미 존재하는지 여부
                const isConflict = currentFileNames.includes(fileName);
                
                // 충돌 여부에 따라 overwrite 옵션 적용
                return moveItem(sourcePath, currentPath, isConflict ? overwriteAll : false)
                    .catch(error => {
                        console.error(`${fileName} 이동 중 오류:`, error);
                        // Promise.allSettled에서 사용하기 위해 실패 결과 객체 반환
                        return {
                            status: 'rejected',
                            fileName: fileName,
                            error: error
                        };
                    });
            });
            
            // 모든 이동 작업 완료 대기
            const results = await Promise.allSettled(movePromises);
            
            // 결과 집계
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'rejected').length;
            const failed = results.filter(r => r.status === 'rejected' || r.value?.status === 'rejected').length;
            const skipped = results.filter(r => r.value?.status === 'skipped').length;
            
            // 실패한 작업이 있으면 오류 메시지 표시
            if (failed > 0) {
                const failedItems = results
                    .filter(r => r.status === 'rejected' || r.value?.status === 'rejected')
                    .map(r => {
                        if (r.status === 'rejected') {
                            return r.reason?.fileName || '알 수 없는 파일';
                        } else {
                            return r.value?.fileName || '알 수 없는 파일';
                        }
                    });
                
                alert(`${succeeded}개 이동 성공, ${failed}개 실패, ${skipped}개 생략됨.\n실패한 항목: ${failedItems.join(', ')}`);
            } else if (skipped > 0) {
                alert(`${succeeded}개 이동 성공, ${skipped}개 생략됨.`);
            } else {
                alert(`${succeeded}개 항목이 이동되었습니다.`);
            }
            
            // 파일 목록 새로고침
            loadFiles(currentPath);
        } catch (error) {
            console.error('파일 이동 중 오류:', error);
            alert('파일 이동 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
    
    // 파일 업로드 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        // 외부 파일 업로드인 경우만 드롭존 표시
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('active');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('active');
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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
                    `${conflictItems.length}개 파일이 이미 존재합니다. 모두 덮어쓰시겠습니까?\n` +
                    `덮어쓸 파일: ${conflictItems.map(item => item.name).join(', ')}`
                );
                overwriteAll = overwriteConfirm;
            }
            
            // 모든 파일 이동 동시에 처리
            const movePromises = draggedItems.map(item => {
                const itemPath = item.path;
                const fileName = item.name;
                const sourcePath = `${itemPath}/${fileName}`;
                
                // 파일이 이미 존재하는지 여부
                const isConflict = currentFileNames.includes(fileName);
                
                // 충돌 여부에 따라 overwrite 옵션 적용
                return moveItem(sourcePath, currentPath, isConflict ? overwriteAll : false)
                    .catch(error => {
                        console.error(`${fileName} 이동 중 오류:`, error);
                        // Promise.allSettled에서 사용하기 위해 실패 결과 객체 반환
                        return {
                            status: 'rejected',
                            fileName: fileName,
                            error: error
                        };
                    });
            });
            
            // 모든 이동 작업 완료 대기
            const results = await Promise.allSettled(movePromises);
            
            // 결과 집계
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'rejected').length;
            const failed = results.filter(r => r.status === 'rejected' || r.value?.status === 'rejected').length;
            const skipped = results.filter(r => r.value?.status === 'skipped').length;
            
            // 실패한 작업이 있으면 오류 메시지 표시
            if (failed > 0) {
                const failedItems = results
                    .filter(r => r.status === 'rejected' || r.value?.status === 'rejected')
                    .map(r => {
                        if (r.status === 'rejected') {
                            return r.reason?.fileName || '알 수 없는 파일';
                        } else {
                            return r.value?.fileName || '알 수 없는 파일';
                        }
                    });
                
                alert(`${succeeded}개 이동 성공, ${failed}개 실패, ${skipped}개 생략됨.\n실패한 항목: ${failedItems.join(', ')}`);
            } else if (skipped > 0) {
                alert(`${succeeded}개 이동 성공, ${skipped}개 생략됨.`);
            } else {
                alert(`${succeeded}개 항목이 이동되었습니다.`);
            }
            
            // 파일 목록 새로고침
            loadFiles(currentPath);
        } catch (error) {
            console.error('파일 이동 중 오류:', error);
            alert('파일 이동 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
    
    // 파일 업로드 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        // 외부 파일 업로드인 경우만 드롭존 표시
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('active');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('active');
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
            fileItem.setAttribute('draggable', 'true'); // 드래그 가능하도록 속성 추가
            
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
            
            // 드래그 관련 이벤트 추가
            fileItem.addEventListener('dragstart', (e) => handleDragStart(e, fileItem));
            fileItem.addEventListener('dragend', handleDragEnd);
            
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
    // 상위 폴더는 드래그되지 않도록 방지
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.preventDefault();
        return;
    }
    
    // 선택되지 않은 항목을 드래그하면 해당 항목만 선택
    if (!fileItem.classList.contains('selected')) {
        clearSelection();
        selectItem(fileItem);
    }
    
    // 단일 항목 드래그 또는 다중 선택 항목 드래그 처리
    if (selectedItems.size > 1) {
        // 여러 항목이 선택된 경우 모든 선택 항목의 ID를 저장
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(selectedItems)));
    } else {
        // 단일 항목 드래그
        e.dataTransfer.setData('text/plain', fileItem.getAttribute('data-name'));
    }
    
    // 드래그 효과 설정
    e.dataTransfer.effectAllowed = 'move';
    
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
    isDragging = false;
}

// 드래그 앤 드롭 초기화
function initDragAndDrop() {
    const items = document.getElementById('items');
    
    // 드래그 시작 이벤트 위임
    items.addEventListener('dragstart', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragStart(e, fileItem);
        }
    });
    
    // 드래그 종료 이벤트 위임
    items.addEventListener('dragend', function(e) {
        const fileItem = e.target.closest('.item');
        if (fileItem) {
            handleDragEnd();
        }
    });
    
    // 드롭존 설정
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        // 1. 외부 파일 업로드 처리
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            
            // 파일 업로드 전 확인
            if (confirm(`${files.length}개의 파일을 업로드하시겠습니까?`)) {
                showLoading();
                uploadFiles(files);
            }
            return;
        }
        
        // 2. 내부 파일 이동 처리
        const draggedItems = JSON.parse(e.dataTransfer.getData('application/json') || '[]');
        if (!draggedItems.length) return;
        
        try {
            // 현재 경로가 드래그한 파일들의 부모 폴더와 같은지 확인
            const isSameFolder = draggedItems.every(item => {
                const itemPath = item.path;
                const itemParentPath = itemPath.split('/').slice(0, -1).join('/');
                return itemParentPath === currentPath;
            });
            
            // 같은 폴더 내에서의 이동이면 아무 작업도 하지 않음
            if (isSameFolder) {
                return;
            }
            
            // 파일 이동 확인
            const moveConfirm = confirm(`선택한 ${draggedItems.length}개의 항목을 현재 폴더로 이동하시겠습니까?`);
            if (!moveConfirm) return;
            
            showLoading();
            
            // 충돌 확인을 위해 현재 폴더의 파일 목록 가져오기
            const currentFiles = await loadFiles(currentPath, true);
            const currentFileNames = currentFiles.map(file => file.name);
            
            // 충돌하는 파일 필터링
            const conflictItems = draggedItems.filter(item => 
                currentFileNames.includes(item.name)
            );
            
            let overwriteAll = false;
            
            // 충돌하는 파일이 있는 경우 일괄 처리 여부 확인
            if (conflictItems.length > 0) {
                const overwriteConfirm = confirm(
                    `${conflictItems.length}개 파일이 이미 존재합니다. 모두 덮어쓰시겠습니까?\n` +
                    `덮어쓸 파일: ${conflictItems.map(item => item.name).join(', ')}`
                );
                overwriteAll = overwriteConfirm;
            }
            
            // 모든 파일 이동 동시에 처리
            const movePromises = draggedItems.map(item => {
                const itemPath = item.path;
                const fileName = item.name;
                const sourcePath = `${itemPath}/${fileName}`;
                
                // 파일이 이미 존재하는지 여부
                const isConflict = currentFileNames.includes(fileName);
                
                // 충돌 여부에 따라 overwrite 옵션 적용
                return moveItem(sourcePath, currentPath, isConflict ? overwriteAll : false)
                    .catch(error => {
                        console.error(`${fileName} 이동 중 오류:`, error);
                        // Promise.allSettled에서 사용하기 위해 실패 결과 객체 반환
                        return {
                            status: 'rejected',
                            fileName: fileName,
                            error: error
                        };
                    });
            });
            
            // 모든 이동 작업 완료 대기
            const results = await Promise.allSettled(movePromises);
            
            // 결과 집계
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status !== 'rejected').length;
            const failed = results.filter(r => r.status === 'rejected' || r.value?.status === 'rejected').length;
            const skipped = results.filter(r => r.value?.status === 'skipped').length;
            
            // 실패한 작업이 있으면 오류 메시지 표시
            if (failed > 0) {
                const failedItems = results
                    .filter(r => r.status === 'rejected' || r.value?.status === 'rejected')
                    .map(r => {
                        if (r.status === 'rejected') {
                            return r.reason?.fileName || '알 수 없는 파일';
                        } else {
                            return r.value?.fileName || '알 수 없는 파일';
                        }
                    });
                
                alert(`${succeeded}개 이동 성공, ${failed}개 실패, ${skipped}개 생략됨.\n실패한 항목: ${failedItems.join(', ')}`);
            } else if (skipped > 0) {
                alert(`${succeeded}개 이동 성공, ${skipped}개 생략됨.`);
            } else {
                alert(`${succeeded}개 항목이 이동되었습니다.`);
            }
            
            // 파일 목록 새로고침
            loadFiles(currentPath);
        } catch (error) {
            console.error('파일 이동 중 오류:', error);
            alert('파일 이동 중 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    });
    
    // 파일 업로드 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        // 외부 파일 업로드인 경우만 드롭존 표시
        if (e.dataTransfer.types.includes('Files')) {
            dropZone.classList.add('active');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        if (e.relatedTarget === null) {
            dropZone.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('active');
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
    