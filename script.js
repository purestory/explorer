// 전역 변수 및 상수 정의
const API_BASE_URL = ''; // 현재 호스트 기준 상대 경로
let currentPath = '';
let selectedItems = new Set();
let clipboard = { items: [], operation: '' }; // cut 또는 copy
let dragSelectActive = false;
let isDragging = false;
let startX, startY;
let listView = true; // 기본값을 true로 설정 (목록 보기)
let uploadSource = ''; // 'button' 또는 'dragdrop'
let uploadButtonCounter = 0;
let dragDropCounter = 0;
let dragDropMoveCounter = 0;
let diskUsage = null;
let sortField = 'name';
let sortDirection = 'asc';
let fileInfoMap = new Map();
let uploadInProgress = false; // 업로드 진행 중 플래그

// DOM 요소 변수 선언
let fileListElement;
let fileView;
let statusInfo;
let breadcrumbElement;
let createFolderBtn;
let folderModal;
let folderNameInput;
let createFolderConfirmBtn;
let cancelFolderBtn;
let fileUploadInput;
let cutBtn;
let pasteBtn;
let renameBtn;
let deleteBtn;
let downloadBtn;
let renameModal;
let newNameInput;
let confirmRenameBtn;
let cancelRenameBtn;
let searchInput;
let loadingOverlay;
let selectionBox;
let dropZoneElement;
let progressContainer;
let progressBarElement;
let uploadStatus;
let contextMenu;
let statusbar;
let selectionInfo;
let gridViewBtn;
let listViewBtn;
let newFolderModal;
let newFolderNameInput;
let renameInput;
let confirmDeleteModal;
let deleteNameSpan;
let confirmOverwriteModal;
let overwriteNameSpan;
let moveModal;
let moveSourceSpan;
let moveTargetInput;
let uploadButton;
let uploadInput;
let newFolderButton;
let storageInfoElement;
let storageBarElement;

// 상황에 맞는 버튼 비활성화/활성화 함수
function updateButtonStates() {
    const selectedCount = selectedItems.size;
    
    if (renameBtn) renameBtn.disabled = selectedCount !== 1;
    if (deleteBtn) deleteBtn.disabled = selectedCount === 0;
    if (cutBtn) cutBtn.disabled = selectedCount === 0;
    if (downloadBtn) downloadBtn.disabled = selectedCount === 0;
    
    // 붙여넣기 버튼은 클립보드에 항목이 있을 때만 활성화
    if (pasteBtn) pasteBtn.disabled = clipboard.items.length === 0;
    
    // 상태바 업데이트
    if (selectionInfo) selectionInfo.textContent = `${selectedCount}개 선택됨`;
    
    // 컨텍스트 메뉴 항목 업데이트
    const ctxRename = document.getElementById('ctxRename');
    const ctxPaste = document.getElementById('ctxPaste');
    const ctxCut = document.getElementById('ctxCut');
    const ctxDelete = document.getElementById('ctxDelete');
    const ctxDownload = document.getElementById('ctxDownload');
    const ctxOpen = document.getElementById('ctxOpen');
    
    if (ctxRename) ctxRename.style.display = selectedCount === 1 ? 'flex' : 'none';
    if (ctxPaste) ctxPaste.style.display = clipboard.items.length > 0 ? 'flex' : 'none';
    if (ctxCut) ctxCut.style.display = selectedCount > 0 ? 'flex' : 'none';
    if (ctxDelete) ctxDelete.style.display = selectedCount > 0 ? 'flex' : 'none';
    if (ctxDownload) ctxDownload.style.display = selectedCount > 0 ? 'flex' : 'none';
    if (ctxOpen) ctxOpen.style.display = selectedCount === 1 ? 'flex' : 'none';
}

// DOM 요소 초기화 함수
function initDOMReferences() {
    // 주요 UI 요소 참조
    fileListElement = document.getElementById('file-list');
    breadcrumbElement = document.getElementById('breadcrumb');
    dropZoneElement = document.getElementById('drop-zone');
    uploadProgressElement = document.getElementById('upload-progress');
    progressBarElement = document.getElementById('progress-bar');
    
    // 모달 요소 참조
    newFolderModal = document.getElementById('new-folder-modal');
    newFolderNameInput = document.getElementById('new-folder-name');
    renameModal = document.getElementById('rename-modal');
    renameInput = document.getElementById('rename-input');
    confirmDeleteModal = document.getElementById('confirm-delete-modal');
    deleteNameSpan = document.getElementById('delete-name');
    confirmOverwriteModal = document.getElementById('confirm-overwrite-modal');
    overwriteNameSpan = document.getElementById('overwrite-name');
    moveModal = document.getElementById('move-modal');
    moveSourceSpan = document.getElementById('move-source');
    moveTargetInput = document.getElementById('move-target');
    
    // 버튼 및 기타 UI 요소
    uploadButton = document.getElementById('upload-button');
    uploadInput = document.getElementById('upload-input');
    newFolderButton = document.getElementById('new-folder-button');
    storageInfoElement = document.getElementById('storage-info');
    storageBarElement = document.getElementById('storage-bar');
    
    if (statusbar) {
        statusInfo = statusbar.querySelector('.status-info');
        selectionInfo = statusbar.querySelector('.selection-info');
    }
}

// 초기화 함수
function init() {
    console.log('WebDAV 파일 탐색기 초기화 중...');
    
    // DOM 요소 참조 초기화
    initDOMReferences();
    
    // 모달 초기화
    initModals();
    
    // 컨텍스트 메뉴 초기화
    initContextMenu();
    
    // 업로드 핸들러 초기화
    initUploadHandlers();
    
    // 히스토리 탐색 초기화
    initHistoryNavigation();
    
    // URL에서 경로 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const pathParam = urlParams.get('path');
    
    // 경로 파라미터가 있으면 해당 경로로 이동
    if (pathParam) {
        currentPath = pathParam;
    }
    
    // 파일 목록 로드
    loadFiles(currentPath);
    
    // 디스크 사용량 로드
    loadDiskUsage();
    
    // 새로고침 버튼 이벤트 리스너
    document.getElementById('refreshStorageBtn')?.addEventListener('click', loadDiskUsage);
    
    console.log('WebDAV 파일 탐색기 초기화 완료');
}

// 문서 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', init);

// 파일 목록 로드 함수
function loadFiles(path = '') {
    // 현재 경로 표시
    if (statusInfo) statusInfo.textContent = `로드 중: ${path || '/'} ...`;
    
    // API 호출을 위한 경로 인코딩
    const encodedPath = encodeURIComponent(path);
    const apiUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
    
    console.log('파일 목록 요청 중...', apiUrl);
    
    // 파일 목록 가져오기
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('파일 목록을 가져올 수 없습니다.');
            }
            return response.json();
        })
        .then(files => {
            // 현재 경로 업데이트
            currentPath = path;
            
            // 파일 목록 정렬
            const sortedFiles = sortFiles(files);
            
            // 파일 목록 표시
            renderFiles(sortedFiles);
            
            // 브레드크럼 업데이트
            updateBreadcrumb(path);
            
            // 상태 업데이트
            if (statusInfo) statusInfo.textContent = `${sortedFiles.length}개 항목`;
            
            // 디스크 사용량 로드 및 표시
            loadDiskUsage();
        })
        .catch(error => {
            console.error('파일 목록 로드 오류:', error);
            if (statusInfo) statusInfo.textContent = '오류: 파일 목록을 가져올 수 없습니다.';
            
            // 오류 발생 시 빈 목록 표시
            renderFiles([]);
        });
}

// 파일 목록 정렬
function sortFiles(files) {
    // 정렬된 파일 배열 복사
    const sortedFiles = [...files];
    
    // 상위 폴더(..)를 추가하기 위한 검사
    const hasParentFolder = sortedFiles.some(file => file.name === '..');
    
    // 루트 폴더가 아니고 상위 폴더가 없으면 추가
    if (currentPath && !hasParentFolder) {
        sortedFiles.unshift({
            name: '..',
            isFolder: true,
            isParentDir: true,
            size: 0,
            modifiedTime: new Date().toISOString()
        });
    }
    
    // 폴더를 파일 앞에 배치, 같은 유형 내에서는 이름 순으로 정렬
    return sortedFiles.sort((a, b) => {
        // 상위 폴더(..)는 항상 최상위에 위치
        if (a.name === '..') return -1;
        if (b.name === '..') return 1;
        
        // 폴더와 파일 구분
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        
        // 정렬 기준에 따라 정렬
        return compareValues(a, b, sortField, sortDirection);
    });
}

// 값 비교 함수
function compareValues(a, b, field, direction) {
    let valA = a[field];
    let valB = b[field];
    
    // 이름 필드는 대소문자 구분 없이 정렬
    if (field === 'name') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
    }
    
    // 오름차순 정렬
    if (direction === 'asc') {
        if (valA < valB) return -1;
        if (valA > valB) return 1;
        return 0;
    } 
    // 내림차순 정렬
    else {
        if (valA > valB) return -1;
        if (valA < valB) return 1;
        return 0;
    }
}

// 파일 크기 포맷 함수
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 날짜 포맷 함수
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// 디스크 사용량 로드
function loadDiskUsage() {
    // API 호출
    fetch(`${API_BASE_URL}/api/disk-usage`)
        .then(response => {
            if (!response.ok) {
                throw new Error('디스크 사용량을 가져올 수 없습니다.');
            }
            return response.json();
        })
        .then(data => {
            diskUsage = data;
            updateStorageInfoDisplay();
        })
        .catch(error => {
            console.error('디스크 사용량 로드 오류:', error);
        });
}

// 저장소 정보 표시 업데이트
function updateStorageInfoDisplay() {
    if (!diskUsage) return;
    
    const storageInfoText = document.getElementById('storageInfoText');
    const storageBar = document.querySelector('.storage-bar');
    
    if (storageInfoText && storageBar) {
        // 사용량 텍스트 업데이트
        const usedText = formatFileSize(diskUsage.used);
        const totalText = formatFileSize(diskUsage.total);
        storageInfoText.querySelector('span').textContent = `${usedText} / ${totalText} (${diskUsage.percent}%)`;
        
        // 사용량 바 업데이트
        storageBar.style.width = `${diskUsage.percent}%`;
        
        // 사용량에 따라 색상 변경
        if (diskUsage.percent > 90) {
            storageBar.style.backgroundColor = '#dc3545'; // 빨간색 (위험)
        } else if (diskUsage.percent > 70) {
            storageBar.style.backgroundColor = '#ffc107'; // 노란색 (주의)
        } else {
            storageBar.style.backgroundColor = '#28a745'; // 녹색 (안전)
        }
    }
}

// 파일 목록 렌더링
function renderFiles(files) {
    // 파일 목록 뷰 초기화
    if (fileView) fileView.innerHTML = '';
    
    // 파일 정보 맵 초기화
    fileInfoMap.clear();
    
    // 파일이 없는 경우 안내 메시지 표시
    if (files.length === 0) {
        if (fileView) fileView.innerHTML = '<div class="empty-folder">이 폴더는 비어 있습니다.</div>';
        return;
    }
    
    // 각 파일 항목 렌더링
    files.forEach(file => {
        // 파일 정보 저장
        fileInfoMap.set(file.name, file);
        
        // 파일 항목 요소 생성
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.setAttribute('data-name', file.name);
        fileItem.setAttribute('data-id', file.name);
        fileItem.setAttribute('data-is-folder', file.isFolder.toString());
        
        // 상위 폴더인 경우 특별 속성 추가
        if (file.name === '..') {
            fileItem.setAttribute('data-parent-dir', 'true');
        }
        
        // 아이콘 설정
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        
        if (file.isFolder) {
            fileIcon.innerHTML = '<i class="fas fa-folder"></i>';
        } else {
            const iconClass = getFileIconClass(file.name);
            fileIcon.innerHTML = `<i class="${iconClass}"></i>`;
        }
        
        // 파일 정보 설정
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        // 파일명 설정
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;
        
        // 추가 정보 (크기, 날짜)
        const fileDetails = document.createElement('div');
        fileDetails.className = 'file-details';
        
        if (!file.isFolder) {
            fileDetails.innerHTML = `
                <span class="file-size">${formatFileSize(file.size)}</span>
                <span class="file-date">${formatDate(file.modifiedTime)}</span>
            `;
        } else {
            fileDetails.innerHTML = `
                <span class="file-size">폴더</span>
                <span class="file-date">${formatDate(file.modifiedTime)}</span>
            `;
        }
        
        // 요소 조합
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileDetails);
        
        fileItem.appendChild(fileIcon);
        fileItem.appendChild(fileInfo);
        
        // 이벤트 리스너 설정
        fileItem.addEventListener('click', (e) => handleFileClick(e, fileItem));
        fileItem.addEventListener('dblclick', (e) => handleFileDblClick(e, fileItem));
        
        // 파일 뷰에 추가
        if (fileView) fileView.appendChild(fileItem);
    });
    
    // 기존 선택 해제
    clearSelection();
}

// 브레드크럼 업데이트
function updateBreadcrumb(path) {
    if (!breadcrumbElement) return;
    
    // 브레드크럼 초기화
    breadcrumbElement.innerHTML = '';
    
    // 홈 링크 추가
    const homeLink = document.createElement('span');
    homeLink.setAttribute('data-path', '');
    homeLink.textContent = '홈';
    homeLink.addEventListener('click', () => {
        navigateToFolder('');
    });
    breadcrumbElement.appendChild(homeLink);
    
    // 경로가 비어있지 않은 경우 경로 분할하여 표시
    if (path) {
        // 경로를 '/' 기준으로 분할
        const pathParts = path.split('/');
        let currentPath = '';
        
        // 각 경로 부분에 대해 링크 생성
        pathParts.forEach((part, index) => {
            // 구분자 추가
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = ' / ';
            breadcrumbElement.appendChild(separator);
            
            // 경로 링크 생성
            currentPath += (index > 0 ? '/' : '') + part;
            const pathLink = document.createElement('span');
            pathLink.setAttribute('data-path', currentPath);
            pathLink.textContent = part;
            
            // 마지막 항목이 아닌 경우에만 클릭 이벤트 설정
            if (index < pathParts.length - 1) {
                pathLink.addEventListener('click', () => {
                    navigateToFolder(currentPath);
                });
            } else {
                pathLink.className = 'current';
            }
            
            breadcrumbElement.appendChild(pathLink);
        });
    }
}

// 파일 클릭 이벤트 처리
function handleFileClick(e, fileItem) {
    // 이미 드래그 중이면 무시
    if (isDragging) return;
    
    // 아이템 ID 가져오기
    const itemName = fileItem.getAttribute('data-name');
    
    // 다중 선택 처리 (Ctrl/Command 키)
    if (e.ctrlKey || e.metaKey) {
        if (fileItem.classList.contains('selected')) {
            // 이미 선택된 경우 선택 해제
            fileItem.classList.remove('selected');
            selectedItems.delete(itemName);
        } else {
            // 선택되지 않은 경우 선택에 추가
            fileItem.classList.add('selected');
            selectedItems.add(itemName);
        }
    } 
    // 범위 선택 처리 (Shift 키)
    else if (e.shiftKey && selectedItems.size > 0) {
        // 기존 선택 항목 유지
        const allItems = Array.from(fileView.querySelectorAll('.file-item:not([data-parent-dir="true"])'));
        const lastSelected = fileView.querySelector('.file-item.selected:not([data-parent-dir="true"])');
        
        if (lastSelected) {
            const startIdx = allItems.indexOf(lastSelected);
            const endIdx = allItems.indexOf(fileItem);
            
            // 선택 범위 결정
            const start = Math.min(startIdx, endIdx);
            const end = Math.max(startIdx, endIdx);
            
            // 범위 내 모든 항목 선택
            for (let i = start; i <= end; i++) {
                const item = allItems[i];
                if (item) {
                    item.classList.add('selected');
                    selectedItems.add(item.getAttribute('data-name'));
                }
            }
        }
    } 
    // 일반 클릭 (단일 선택)
    else {
        selectItem(fileItem);
    }
    
    // 버튼 상태 업데이트
    updateButtonStates();
}

// 파일 더블 클릭 이벤트 처리
function handleFileDblClick(e, fileItem) {
    e.preventDefault();
    e.stopPropagation();
    
    // 드래그 중이면 무시
    if (isDragging) return;
    
    const fileName = fileItem.getAttribute('data-name');
    const isFolder = fileItem.getAttribute('data-is-folder') === 'true';
    
    // 폴더인 경우 해당 폴더로 이동
    if (isFolder) {
        navigateToFolder(fileName);
    }
    // 파일인 경우 해당 파일 열기
    else {
        openFile(fileName);
    }
}

// 폴더로 이동
function navigateToFolder(folderName) {
    let newPath = '';
    
    // 상위 폴더로 이동하는 경우
    if (folderName === '..') {
        navigateToParentFolder();
        return;
    }
    // 루트 폴더로 이동
    else if (folderName === '') {
        newPath = '';
    }
    // 절대 경로로 지정된 경우
    else if (folderName.startsWith('/')) {
        newPath = folderName.substring(1); // 첫 번째 '/' 제거
    }
    // 상대 경로인 경우 현재 경로에 추가
    else {
        newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    }
    
    // 브라우저 히스토리 상태 업데이트
    updateHistoryState(newPath);
    
    // 파일 목록 로드
    loadFiles(newPath);
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
}

// 파일 열기 함수
function openFile(fileName) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const encodedPath = encodeURIComponent(filePath);
    const fileUrl = `${API_BASE_URL}/api/files/${encodedPath}`;
    
    // 새 창에서 파일 열기
    window.open(fileUrl, '_blank');
    
    console.log(`파일 열기: ${fileName}`);
    if (statusInfo) statusInfo.textContent = `파일 열기: ${fileName}`;
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

// 브라우저 히스토리 상태 업데이트
function updateHistoryState(path) {
    const state = { path: path };
    const url = new URL(window.location.href);
    url.searchParams.set('path', path);
    
    // 현재 상태 교체
    window.history.pushState(state, '', url);
}

// 브라우저 히스토리 탐색 초기화
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

// 모달 초기화 함수
function initModals() {
    // 새 폴더 모달 초기화
    document.getElementById('create-folder-btn')?.addEventListener('click', () => {
        createFolder(newFolderNameInput.value.trim());
    });
    
    // 이름 변경 모달 초기화
    document.getElementById('rename-btn')?.addEventListener('click', () => {
        renameItem(selectedItem, renameInput.value.trim());
    });
    
    // 삭제 확인 모달 초기화
    document.getElementById('delete-btn')?.addEventListener('click', () => {
        deleteItem(selectedItem);
    });
    
    // 덮어쓰기 확인 모달 초기화
    document.getElementById('overwrite-btn')?.addEventListener('click', () => {
        handleOverwriteConfirm();
    });
    
    document.getElementById('skip-btn')?.addEventListener('click', () => {
        handleSkipOverwrite();
    });
    
    // 이동 모달 초기화
    document.getElementById('move-btn')?.addEventListener('click', () => {
        moveItem(moveItemSource, moveTargetInput.value.trim());
    });
    
    // 모달 닫기 버튼 초기화
    document.querySelectorAll('.modal .close, .modal .cancel-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.closest('.modal').id;
            document.getElementById(modalId).style.display = 'none';
        });
    });
    
    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', (e) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// 컨텍스트 메뉴 초기화
function initContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    
    // 컨텍스트 메뉴 표시
    function showContextMenu(e, item) {
        e.preventDefault();
        
        // 현재 선택된 아이템 업데이트
        selectItem(item);
        
        // 컨텍스트 메뉴 위치 설정
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.display = 'block';
        
        // 폴더인 경우에만 '열기' 옵션 표시
        const openOption = document.getElementById('context-open');
        if (openOption) {
            const isFolder = item.getAttribute('data-is-folder') === 'true';
            openOption.style.display = isFolder ? 'block' : 'none';
        }
        
        // 클릭 이벤트 리스너 추가하여 메뉴 외부 클릭 시 닫기
        setTimeout(() => {
            document.addEventListener('click', closeContextMenu);
        }, 0);
    }
    
    // 컨텍스트 메뉴 닫기
    function closeContextMenu() {
        contextMenu.style.display = 'none';
        document.removeEventListener('click', closeContextMenu);
    }
    
    // 파일 목록에 컨텍스트 메뉴 이벤트 리스너 추가
    fileListElement.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.file-item');
        if (item) {
            showContextMenu(e, item);
        }
    });
    
    // 컨텍스트 메뉴 옵션 이벤트 리스너
    document.getElementById('context-open')?.addEventListener('click', () => {
        if (selectedItem) {
            const isFolder = selectedItem.getAttribute('data-is-folder') === 'true';
            if (isFolder) {
                navigateToFolder(selectedItem.getAttribute('data-path'));
            }
        }
    });
    
    document.getElementById('context-download')?.addEventListener('click', () => {
        if (selectedItem) {
            downloadFile(selectedItem.getAttribute('data-path'));
        }
    });
    
    document.getElementById('context-rename')?.addEventListener('click', () => {
        if (selectedItem) {
            openRenameModal(selectedItem);
        }
    });
    
    document.getElementById('context-delete')?.addEventListener('click', () => {
        if (selectedItem) {
            openDeleteModal(selectedItem);
        }
    });
    
    document.getElementById('context-move')?.addEventListener('click', () => {
        if (selectedItem) {
            openMoveModal(selectedItem.getAttribute('data-path'));
        }
    });
}

// 파일 업로드 초기화
function initUploadHandlers() {
    // 업로드 버튼 클릭 이벤트
    uploadButton?.addEventListener('click', () => {
        uploadInput.click();
    });
    
    // 파일 선택 변경 이벤트
    uploadInput?.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            uploadFiles(files);
        }
    });
    
    // 드래그 앤 드롭 이벤트
    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 외부 파일 드래그일 경우만 처리
        if (isDragSourceExternal(e)) {
            dropZoneElement.classList.add('active');
        }
    });
    
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 드롭존 영역을 벗어났을 때만 비활성화
        if (e.target === dropZoneElement || !dropZoneElement.contains(e.relatedTarget)) {
            dropZoneElement.classList.remove('active');
        }
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        dropZoneElement.classList.remove('active');
        
        const folderItem = e.target.closest('.file-item[data-is-folder="true"]');
        let targetPath = currentPath;
        
        // 폴더 아이템에 드롭된 경우 해당 폴더 경로로 설정
        if (folderItem) {
            targetPath = folderItem.getAttribute('data-path');
            folderItem.classList.remove('drag-over');
        }
        
        // 외부 파일 드롭인 경우 업로드
        if (e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files, targetPath);
        }
    });
    
    // 파일 아이템에 대한 드래그 이벤트 위임
    fileListElement?.addEventListener('dragenter', (e) => {
        const folderItem = e.target.closest('.file-item[data-is-folder="true"]');
        
        // 외부 파일 드래그인 경우 폴더 아이템에 효과 적용
        if (isDragSourceExternal(e) && folderItem) {
            folderItem.classList.add('drag-over');
            if (dropZoneElement.classList.contains('active')) {
                dropZoneElement.classList.remove('active');
            }
        }
    });
    
    fileListElement?.addEventListener('dragleave', (e) => {
        const folderItem = e.target.closest('.file-item[data-is-folder="true"]');
        
        // 폴더 아이템을 벗어났을 때 효과 제거
        if (folderItem && !folderItem.contains(e.relatedTarget)) {
            folderItem.classList.remove('drag-over');
            
            // 문서 영역으로 다시 드래그한 경우 드롭존 활성화
            if (isDragSourceExternal(e) && !e.target.closest('.file-item')) {
                dropZoneElement.classList.add('active');
            }
        }
    });
}

// 드래그 소스가 외부 파일인지 확인
function isDragSourceExternal(e) {
    // dataTransfer 타입 확인: 파일이 포함되어 있으면 외부 드래그
    if (e.dataTransfer.types) {
        return e.dataTransfer.types.includes('Files');
    }
    return false;
}

// 파일 업로드 함수
function uploadFiles(files, targetPath = currentPath) {
    if (files.length === 0) return;
    
    const formData = new FormData();
    const totalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
    let uploadedSize = 0;
    
    // 폼 데이터에 파일 추가
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    
    // 업로드 상태 표시
    uploadProgressElement.style.display = 'flex';
    progressBarElement.style.width = '0%';
    
    // 충돌 확인 및 업로드 수행
    checkExistingFilesBeforeUpload(files, targetPath)
        .then(({ proceed, overwrite }) => {
            if (!proceed) {
                uploadProgressElement.style.display = 'none';
                return Promise.reject('업로드가 취소되었습니다.');
            }
            
            // 폼 데이터에 덮어쓰기 옵션 추가
            formData.append('overwrite', overwrite);
            
            // 파일 업로드 요청
            return fetch(`${API_BASE_URL}/api/files/${targetPath}?action=upload`, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(result => {
            // 업로드 완료 처리
            uploadProgressElement.style.display = 'none';
            
            // 파일 목록 갱신
            loadFiles(targetPath);
            
            // 성공 메시지 표시
            showNotification(`${result.uploaded} 파일 업로드 완료${result.skipped > 0 ? `, ${result.skipped} 파일 건너뜀` : ''}`, 'success');
        })
        .catch(error => {
            uploadProgressElement.style.display = 'none';
            showNotification(typeof error === 'string' ? error : `업로드 중 오류 발생: ${error.message || '알 수 없는 오류'}`, 'error');
        });
    
    // 업로드 진행 상황 표시
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            progressBarElement.style.width = `${progress}%`;
        }
    });
}

// 업로드 전 파일 충돌 확인
async function checkExistingFilesBeforeUpload(files, targetPath) {
    try {
        // 현재 폴더의 파일 목록 가져오기
        const response = await fetch(`${API_BASE_URL}/api/files/${targetPath}?action=list`);
        if (!response.ok) {
            throw new Error('파일 목록을 가져오는데 실패했습니다.');
        }
        
        const data = await response.json();
        const existingFiles = data.files.map(file => file.name);
        
        // 업로드할 파일 중 이미 존재하는 파일 찾기
        const conflictingFiles = Array.from(files)
            .filter(file => existingFiles.includes(file.name))
            .map(file => file.name);
        
        // 충돌 파일이 없으면 바로 진행
        if (conflictingFiles.length === 0) {
            return { proceed: true, overwrite: false };
        }
        
        // 사용자에게 확인
        return new Promise((resolve) => {
            // 충돌 메시지 설정
            const conflictMessage = conflictingFiles.length === 1
                ? `'${conflictingFiles[0]}'은(는) 이미 존재합니다.`
                : `${conflictingFiles.length}개의 파일(${conflictingFiles.slice(0, 3).join(', ')}${conflictingFiles.length > 3 ? '...' : ''})이 이미 존재합니다.`;
            
            if (confirm(`${conflictMessage} 덮어쓸까요?`)) {
                resolve({ proceed: true, overwrite: true });
            } else {
                resolve({ proceed: false, overwrite: false });
            }
        });
    } catch (error) {
        console.error('충돌 확인 중 오류:', error);
        // 오류 발생 시 사용자에게 계속 진행할지 확인
        if (confirm('파일 충돌 확인 중 오류가 발생했습니다. 계속 진행할까요?')) {
            return { proceed: true, overwrite: false };
        } else {
            return { proceed: false, overwrite: false };
        }
    }
}
