// frontend/upload.js
// --- 전역 변수 선언 ---
let uploadProgressModal;
let overallProgressBar;
let overallProgressText;
let currentFileInfo;
let cancelUploadBtn;
let uploadSpeed;
let uploadTimeRemaining;
let toggleFileListBtn;
let uploadFileList;

// --- 업로드 상태 관리 ---
let currentUploadXHR = null; // 현재 진행중인 XHR 객체 (취소용)
let isCancelled = false; // 업로드 취소 플래그
let uploadStartTime = 0; // 업로드 시작 시간
let lastLoaded = 0; // 마지막으로 측정된 로드 바이트
let lastLoadTime = 0; // 마지막 로드 측정 시간
let currentSpeed = 0; // 현재 업로드 속도 (bytes/s)
let speedHistory = []; // 속도 측정 이력 (평균 계산용)
let totalBytesToUpload = 0; // 전체 업로드할 바이트
let totalBytesUploaded = 0; // 총 업로드된 바이트

// 파일 상태 추적 배열
let uploadFileStates = [];

// --- 모달 제어 함수 ---
function showUploadModal() {
    // 요소 초기화 확인 (함수 호출 시점에도 확인)
    if (!uploadProgressModal || !overallProgressBar || !overallProgressText || !currentFileInfo || !cancelUploadBtn) {
        console.error('[Upload] Modal elements not initialized correctly. Cannot show modal.');
        if (typeof showToast === 'function') showToast('업로드 UI를 표시할 수 없습니다.', 'error');
        return; 
    }
    
    // 업로드 상태 초기화
    isCancelled = false; 
    uploadStartTime = Date.now();
    lastLoaded = 0;
    lastLoadTime = uploadStartTime;
    currentSpeed = 0;
    speedHistory = [];
    
    // 모달 표시 및 초기화
    uploadProgressModal.style.display = 'flex'; 
    overallProgressBar.style.width = '0%';
    overallProgressText.textContent = '업로드 준비 중...';
    currentFileInfo.textContent = '';
    uploadSpeed.textContent = '속도: 0 KB/s';
    uploadTimeRemaining.textContent = '남은 시간: 계산 중...';
    
    // 파일 목록 초기화
    uploadFileList.innerHTML = '';
    uploadFileList.classList.remove('show');
    toggleFileListBtn.classList.remove('active');
    
    // 취소 버튼 초기화
    if (cancelUploadBtn) {
        cancelUploadBtn.disabled = false; 
        cancelUploadBtn.onclick = cancelUpload; 
    }
}

function hideUploadModal() {
    if (uploadProgressModal) {
        uploadProgressModal.style.display = 'none';
    }
    if (cancelUploadBtn) {
        cancelUploadBtn.disabled = true; 
    }
    currentUploadXHR = null; 
}

// 속도 계산 및 시간 추정 함수
function updateSpeedAndTime(loaded, total, fileIndex, totalFiles) {
    const now = Date.now();
    const elapsedSinceLastUpdate = (now - lastLoadTime) / 1000; // 초 단위
    
    if (elapsedSinceLastUpdate > 0.5) { // 최소 0.5초마다 업데이트
        const loadedSinceLastUpdate = loaded - lastLoaded;
        let instantSpeed = 0;
        
        // 속도 계산 (0으로 나누는 오류 방지)
        if (elapsedSinceLastUpdate > 0) {
            instantSpeed = loadedSinceLastUpdate / elapsedSinceLastUpdate; // 바이트/초
        }
        
        // 속도가 유효한 값인 경우만 이력에 추가
        if (instantSpeed > 0 && !isNaN(instantSpeed) && isFinite(instantSpeed)) {
            // 속도 이력에 추가 (최근 5개만 유지)
            speedHistory.push(instantSpeed);
            if (speedHistory.length > 5) {
                speedHistory.shift();
            }
            
            // 가중 평균 속도 계산 (최근 값에 더 높은 가중치)
            let totalWeight = 0;
            let weightedSpeed = 0;
            for (let i = 0; i < speedHistory.length; i++) {
                const weight = i + 1; // 더 최근 값에 더 큰 가중치
                weightedSpeed += speedHistory[i] * weight;
                totalWeight += weight;
            }
            
            // 유효한 속도가 계산된 경우에만 현재 속도 업데이트
            if (totalWeight > 0) {
                currentSpeed = weightedSpeed / totalWeight;
            }
        }
        
        // 총 업로드된 바이트 및 남은 바이트 계산
        let remainingBytes = 0;
        if (fileIndex > 0 && totalFiles > 0 && total > 0) {
            totalBytesUploaded = (fileIndex - 1) * (total / totalFiles) + loaded;
            remainingBytes = Math.max(0, totalBytesToUpload - totalBytesUploaded);
        }
        
        // 남은 시간 계산 (속도가 0보다 클 때만)
        let remainingTime = '';
        if (currentSpeed > 0 && !isNaN(currentSpeed) && isFinite(currentSpeed) && remainingBytes > 0) {
            const secondsRemaining = Math.ceil(remainingBytes / currentSpeed);
            
            if (secondsRemaining < 60) {
                remainingTime = `${secondsRemaining}초`;
            } else if (secondsRemaining < 3600) {
                remainingTime = `${Math.floor(secondsRemaining / 60)}분 ${secondsRemaining % 60}초`;
            } else {
                remainingTime = `${Math.floor(secondsRemaining / 3600)}시간 ${Math.floor((secondsRemaining % 3600) / 60)}분`;
            }
        } else {
            remainingTime = '계산 중...';
        }
        
        // UI 업데이트
        if (uploadSpeed) {
            if (currentSpeed > 0 && !isNaN(currentSpeed) && isFinite(currentSpeed)) {
                uploadSpeed.textContent = `속도: ${formatFileSize(currentSpeed)}/s`;
            } else {
                uploadSpeed.textContent = '속도: 측정 중...';
            }
        }
        
        if (uploadTimeRemaining) {
            uploadTimeRemaining.textContent = `남은 시간: ${remainingTime}`;
        }
        
        // 마지막 측정 값 업데이트
        lastLoaded = loaded;
        lastLoadTime = now;
    }
}

// 파일 크기 포맷팅 함수
function formatFileSize(bytes) {
    if (bytes === 0 || isNaN(bytes) || !isFinite(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.max(1, bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[Math.min(i, sizes.length - 1)];
}

// 파일 목록 초기화 함수
function initializeFileList(filesWithPaths) {
    if (!uploadFileList || !toggleFileListBtn) return;
    
    uploadFileStates = filesWithPaths.map(({file, relativePath}) => ({
        name: relativePath || file.name,
        size: file.size,
        status: 'pending', // pending, uploading, completed, failed
        progress: 0
    }));
    
    renderFileList();
}

// 파일 목록 렌더링 함수
function renderFileList() {
    if (!uploadFileList) return;
    
    uploadFileList.innerHTML = '';
    
    uploadFileStates.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'upload-file-item';
        fileItem.dataset.filename = file.name;
        
        const fileName = document.createElement('div');
        fileName.className = 'upload-file-name';
        fileName.textContent = file.name;
        
        const fileStatus = document.createElement('div');
        fileStatus.className = `upload-file-status ${file.status}`;
        
        switch (file.status) {
            case 'pending':
                fileStatus.textContent = '대기 중';
                break;
            case 'uploading':
                fileStatus.textContent = `${file.progress}%`;
                break;
            case 'completed':
                fileStatus.textContent = '완료';
                break;
            case 'failed':
                fileStatus.textContent = '실패';
                break;
        }
        
        fileItem.appendChild(fileName);
        fileItem.appendChild(fileStatus);
        uploadFileList.appendChild(fileItem);
    });
}

// 파일 상태 업데이트 함수
function updateFileStatus(fileName, status, progress = 0) {
    const fileIndex = uploadFileStates.findIndex(f => f.name === fileName);
    if (fileIndex === -1) return;
    
    uploadFileStates[fileIndex].status = status;
    if (status === 'uploading') {
        uploadFileStates[fileIndex].progress = progress;
    }
    
    renderFileList();
}

function updateUploadProgress(overallPercent, currentFileIndex, totalFiles, currentFileName, currentFilePercent) {
    if (!overallProgressBar || !overallProgressText || !currentFileInfo) {
        return;
    }
    
    overallProgressBar.style.width = `${overallPercent}%`;
    overallProgressText.textContent = `전체 진행률: ${overallPercent}% (${currentFileIndex}/${totalFiles} 파일)`;
    currentFileInfo.textContent = `현재 파일: ${currentFileName} (${currentFilePercent}%)`;
    
    // 현재 파일 상태 업데이트
    updateFileStatus(currentFileName, 'uploading', currentFilePercent);
}

// --- 개별 파일 업로드 함수 (XMLHttpRequest 사용) ---
async function uploadSingleFile(file, targetPath, relativePath, fileIndex, totalFiles) {
    return new Promise((resolve, reject) => {
        if (isCancelled) {
            console.log(`[Upload] 시작 시 취소됨: ${relativePath}`);
            updateFileStatus(relativePath, 'pending');
            return resolve({ cancelled: true });
        }
        
        // 현재 파일 상태 업데이트
        updateFileStatus(relativePath, 'uploading', 0);

        const xhr = new XMLHttpRequest();
        currentUploadXHR = xhr; 
        const formData = new FormData();
        
        // 서버 기대 포맷으로 수정 (server.js에서 file_0 형식으로 기대함)
        formData.append('file_0', file, relativePath);
        
        // 필수 필드: path와 fileInfo
        formData.append('path', targetPath);
        
        // fileInfo 배열 추가 (백엔드가 요구하는 포맷)
        const fileInfo = [{
            originalName: file.name,
            relativePath: relativePath,
            size: file.size,
            index: 0
        }];
        formData.append('fileInfo', JSON.stringify(fileInfo));
        
        // URL에서 path 쿼리 파라미터 제거
        const uploadUrl = `${API_BASE_URL}/api/upload`; 

        xhr.open('POST', uploadUrl, true);

        xhr.upload.onprogress = (event) => {
            if (isCancelled) return;
            if (event.lengthComputable) {
                const currentFilePercent = Math.round((event.loaded / event.total) * 100);
                const overallPercent = Math.round(((fileIndex - 1) * 100 + currentFilePercent) / totalFiles);
                updateUploadProgress(overallPercent, fileIndex, totalFiles, relativePath, currentFilePercent);
                
                // 속도 및 남은 시간 업데이트
                updateSpeedAndTime(event.loaded, event.total, fileIndex, totalFiles);
            }
        };

        xhr.onload = () => {
            currentUploadXHR = null; 
            if (isCancelled) {
                console.log(`[Upload] 완료되었지만 취소됨: ${relativePath}`);
                return resolve({ cancelled: true });
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                console.log(`[Upload] 파일 업로드 성공: ${relativePath}`);
                const overallPercent = Math.round((fileIndex * 100) / totalFiles);
                updateUploadProgress(overallPercent, fileIndex, totalFiles, relativePath, 100);
                updateFileStatus(relativePath, 'completed');
                resolve({ success: true, file: relativePath });
            } else {
                console.error(`[Upload] 파일 업로드 실패: ${relativePath}, 상태: ${xhr.status}`);
                let errorMessage = `파일 업로드 실패: ${relativePath}`;
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    errorMessage = errorResponse.message || errorMessage;
                } catch (e) {
                    errorMessage = xhr.responseText || errorMessage;
                }
                updateFileStatus(relativePath, 'failed');
                reject(new Error(errorMessage));
            }
        };

        xhr.onerror = () => {
            currentUploadXHR = null; 
            if (isCancelled) {
                console.log(`[Upload] 네트워크 오류 발생했으나 취소됨: ${relativePath}`);
                return resolve({ cancelled: true });
            }
            console.error(`[Upload] 네트워크 오류 발생: ${relativePath}`);
            updateFileStatus(relativePath, 'failed');
            reject(new Error(`네트워크 오류 발생: ${relativePath}`));
        };

        xhr.onabort = () => {
            currentUploadXHR = null; 
            console.log(`[Upload] 업로드 중단됨 (onabort): ${relativePath}`);
            resolve({ cancelled: true });
        };

        console.log(`[Upload] 업로드 시작: ${relativePath} -> ${targetPath}`);
        xhr.send(formData);
    });
}

// --- 순차적 파일 업로드 관리 함수 ---
async function uploadFilesSequentially(filesWithPaths, targetPath) {
    // 함수 시작 시 모달 요소 확인
    if (!uploadProgressModal) {
        console.error('[Upload] Upload modal not initialized. Cannot start upload sequence.');
        if (typeof showToast === 'function') showToast('업로드 UI가 준비되지 않았습니다.', 'error');
        return;
    }
    
    showUploadModal();
    const totalFiles = filesWithPaths.length;
    let uploadedCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    const failedFiles = [];
    
    // 전체 업로드할 바이트 계산
    totalBytesToUpload = filesWithPaths.reduce((sum, { file }) => sum + file.size, 0);
    
    // 파일 목록 초기화
    initializeFileList(filesWithPaths);

    console.log(`[Upload Seq] 총 ${totalFiles}개 파일 순차 업로드 시작. 대상 경로: ${targetPath}`);

    for (let i = 0; i < totalFiles; i++) {
        if (isCancelled) {
            console.log('[Upload Seq] 사용자에 의해 업로드가 중단되었습니다. 루프 종료.');
            cancelledCount = totalFiles - uploadedCount - failedCount;
            break;
        }

        const { file, relativePath } = filesWithPaths[i];
        const fileIndex = i + 1;

        try {
            const result = await uploadSingleFile(file, targetPath, relativePath, fileIndex, totalFiles);
            
            if (result.success) {
                uploadedCount++;
            } else if (result.cancelled) {
                console.log(`[Upload Seq] 파일 ${relativePath} 업로드 취소됨 (내부 확인)`);
                cancelledCount++;
                isCancelled = true; 
                break;
            } else {
                console.warn(`[Upload Seq] 예상치 못한 결과: ${relativePath}`, result);
            }

        } catch (error) {
            if (!isCancelled) {
                failedCount++;
                failedFiles.push(relativePath || file.name);
                console.error(`[Upload Seq] ${fileIndex}/${totalFiles} 파일 업로드 실패: ${relativePath}`, error);
                if (typeof showToast === 'function') showToast(`파일 업로드 실패: ${relativePath} - ${error.message}`, 'error', 5000);
                await new Promise(resolve => setTimeout(resolve, 300));
            } else {
                console.log(`[Upload Seq] 오류 발생했으나 이미 취소됨: ${relativePath}`, error.message);
                cancelledCount++;
                break;
            }
        }
    }

    hideUploadModal(); 

    // 최종 결과 알림 (showToast 함수가 script.js에 있다고 가정)
    if (typeof showToast === 'function') {
        let finalMessage = '';
        let messageType = 'info';

        if (failedCount > 0) {
            finalMessage = `${uploadedCount}개 성공, ${failedCount}개 실패.`;
            if (cancelledCount > 0) finalMessage += ` ${cancelledCount}개 취소.`;
            finalMessage += ` 실패 목록: ${failedFiles.join(', ')}`;
            messageType = 'warning';
        } else if (cancelledCount > 0) {
            finalMessage = `업로드가 취소되었습니다. (${uploadedCount}/${totalFiles} 완료)`;
            messageType = 'warning';
        } else if (uploadedCount === totalFiles && totalFiles > 0) {
            finalMessage = `${totalFiles}개 파일 업로드를 완료했습니다.`;
            messageType = 'success';
        } else if (totalFiles === 0) {
            finalMessage = '업로드할 파일이 없습니다.';
            messageType = 'info';
        } else {
            finalMessage = `업로드 작업 완료 (${uploadedCount} 성공, ${failedCount} 실패, ${cancelledCount} 취소)`;
            messageType = 'info';
        }
        
        if (finalMessage) {
            showToast(finalMessage, messageType);
        }
    }

    // 파일 목록 새로고침 (loadFiles 함수가 script.js에 있다고 가정)
    if (typeof loadFiles === 'function') {
        // 서버가 파일을 처리할 시간을 주기 위해 약간의 지연 후 파일 목록 새로고침
        setTimeout(() => {
            console.log('[Upload] 업로드 완료 후 파일 목록 새로고침 시작');
            loadFiles(currentPath);
            
            // 한번 더 새로고침 (서버 지연 처리 대응)
            setTimeout(() => {
                console.log('[Upload] 2차 파일 목록 새로고침 시작');
                loadFiles(currentPath);
            }, 1500);
        }, 500);
    }
}

// --- 폴더 구조 순회 함수 --- 
async function traverseFileTree(entry, path, filesWithPaths) {
    path = path || "";
    if (entry.isFile) {
        return new Promise((resolve, reject) => {
            entry.file(file => {
                const normalizedName = file.name.normalize ? file.name.normalize('NFC') : file.name;
                const separator = path && !path.endsWith('/') ? '/' : ''; 
                const relativeFilePath = path + separator + normalizedName;
                const normalizedPath = relativeFilePath.normalize ? relativeFilePath.normalize('NFC') : relativeFilePath;
                
                filesWithPaths.push({ file: file, relativePath: normalizedPath });
                resolve();
            }, err => {
                console.error("파일 접근 오류:", path + entry.name, err);
                reject(err); 
            });
        });
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const normalizedDirName = entry.name.normalize ? entry.name.normalize('NFC') : entry.name;
        const separator = path && !path.endsWith('/') && path !== '' ? '/' : '';
        const currentDirPath = path + separator + normalizedDirName + "/"; 
        
        return new Promise((resolve, reject) => {
            dirReader.readEntries(async (entries) => {
                const promises = [];
                for (let i = 0; i < entries.length; i++) {
                    promises.push(traverseFileTree(entries[i], currentDirPath, filesWithPaths));
                }
                try {
                    await Promise.all(promises);
                    resolve();
                } catch (err) {
                    console.error("하위 디렉토리 처리 오류:", currentDirPath, err);
                    reject(err); 
                }
            }, err => {
                console.error("디렉토리 읽기 오류:", path + entry.name, err);
                reject(err);
            });
        });
    }
}

// --- 외부 파일 드롭 처리 함수 (handleExternalFileDrop) ---
// 이 함수는 전역 스코프에 노출되어야 script.js에서 호출 가능
window.handleExternalFileDrop = async (e, targetFolderItem = null) => {
    console.log('[Upload] handleExternalFileDrop 시작');
    try {
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) {
            console.log('[Upload] 드롭된 항목이 없습니다.');
            return;
        }

        // script.js의 변수 및 함수 접근
        const currentPath = typeof window.currentPath !== 'undefined' ? window.currentPath : '';
        const showLoading = typeof window.showLoading === 'function' ? window.showLoading : null;
        const hideLoading = typeof window.hideLoading === 'function' ? window.hideLoading : null;
        const showToast = typeof window.showToast === 'function' ? window.showToast : null;
        const isPathLocked = typeof window.isPathLocked === 'function' ? window.isPathLocked : null;

        let targetPath = currentPath; 
        let targetName = '현재 폴더';

        if (targetFolderItem && typeof targetFolderItem.getAttribute === 'function' && targetFolderItem.hasAttribute('data-name')) {
            const folderName = targetFolderItem.getAttribute('data-name');
            const potentialTargetPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            if (isPathLocked && isPathLocked(potentialTargetPath)) {
                console.warn(`[Upload] 잠긴 폴더 '${folderName}'(으)로는 업로드할 수 없습니다.`);
                if (showToast) showToast(`잠긴 폴더 '${folderName}'(으)로는 업로드할 수 없습니다.`, 'warning');
                return; 
            } else if (!isPathLocked) {
                console.warn('[Upload] isPathLocked 함수 없음. 잠금 확인 없이 진행.');
            }
            targetPath = potentialTargetPath;
            targetName = folderName;
            console.log('[Upload] 외부 파일 드래그 감지: 대상 폴더:', targetName);
        } else {
            if (isPathLocked && isPathLocked(currentPath)) {
                console.warn(`[Upload] 현재 폴더 '${currentPath || '루트'}'가 잠겨 있어 업로드할 수 없습니다.`);
                if (showToast) showToast('현재 폴더가 잠겨 있어 업로드할 수 없습니다.', 'warning');
                return; 
            } else if (!isPathLocked){
                console.warn('[Upload] isPathLocked 함수 없음. 현재 폴더 잠금 확인 없이 진행.');
            }
            console.log('[Upload] 외부 파일 드래그 감지: 현재 경로(', targetPath || '루트' ,')에 업로드');
        }

        // 로딩 표시
        if (showLoading) showLoading(); 
        else console.warn('[Upload] showLoading 함수를 찾을 수 없습니다.');

        const filesWithPaths = [];
        const promises = [];
        let hasEntries = false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    hasEntries = true;
                    promises.push(traverseFileTree(entry, '', filesWithPaths));
                } else {
                    const file = item.getAsFile();
                    if (file) {
                        const normalizedName = file.name.normalize ? file.name.normalize('NFC') : file.name;
                        filesWithPaths.push({ file, relativePath: normalizedName });
                    }
                }
            }
        }
        
        if (hasEntries) {
            try {
                await Promise.all(promises); 
            } catch (treeError) {
                console.error('[Upload] 파일 트리 순회 중 최종 오류:', treeError);
                if (showToast) showToast('폴더 구조를 읽는 중 오류가 발생했습니다.', 'error');
                if (hideLoading) hideLoading();
                return; 
            }
        }

        // 로딩 숨김
        if (hideLoading) hideLoading(); 
        else console.warn('[Upload] hideLoading 함수를 찾을 수 없습니다.');

        if (filesWithPaths.length === 0) {
            console.log('[Upload] 업로드할 파일을 찾을 수 없습니다.');
            if (showToast) showToast('업로드할 파일을 찾을 수 없습니다.', 'warning');
            return;
        }

        console.log(`[Upload] 총 ${filesWithPaths.length}개의 파일 수집 완료. 순차 업로드 시작.`);
        await uploadFilesSequentially(filesWithPaths, targetPath);

    } catch (error) {
        console.error('[Upload] 외부 파일 드롭 처리 중 예상치 못한 오류:', error);
        const hideLoading = typeof window.hideLoading === 'function' ? window.hideLoading : null;
        const showToast = typeof window.showToast === 'function' ? window.showToast : null;
        if (showToast) showToast(`파일 드롭 처리 중 오류 발생: ${error.message}`, 'error');
        if (hideLoading) hideLoading(); 
    } 
};

// --- 업로드 취소 함수 --- 
function cancelUpload() {
    if (!isCancelled) {
        isCancelled = true;
        console.log('[Upload] 사용자가 업로드를 취소했습니다.');
        
        if (typeof showToast === 'function') {
            showToast('업로드가 취소되었습니다.', 'warning');
        }
        
        // 현재 진행 중인 XHR 요청 취소
        if (currentUploadXHR) {
            currentUploadXHR.abort();
            currentUploadXHR = null;
        }
        
        // 대기 중인 파일들의 상태 업데이트
        uploadFileStates.forEach(file => {
            if (file.status === 'pending') {
                updateFileStatus(file.name, 'cancelled');
            }
        });
        
        // 취소 버튼 비활성화
        if (cancelUploadBtn) {
            cancelUploadBtn.disabled = true;
            cancelUploadBtn.textContent = '취소됨';
        }
    }
}

// --- 초기화 함수 (initializeUploader) ---
// 이 함수는 전역 스코프에 노출되어야 script.js에서 호출 가능
window.initializeUploader = function() {
    console.log('[Upload Init] 업로더 초기화 시작...');
    
    // DOM 요소 초기화
    uploadProgressModal = document.getElementById('upload-progress-modal');
    overallProgressBar = document.getElementById('overall-progress-bar');
    overallProgressText = document.getElementById('overall-progress-text');
    currentFileInfo = document.getElementById('current-file-info');
    cancelUploadBtn = document.getElementById('cancel-upload-btn');
    uploadSpeed = document.getElementById('upload-speed');
    uploadTimeRemaining = document.getElementById('upload-time-remaining');
    toggleFileListBtn = document.getElementById('toggle-file-list-btn');
    uploadFileList = document.getElementById('upload-file-list');
    
    // --- 요소 존재 확인 (초기화 시) ---
    if (!uploadProgressModal || !overallProgressBar || !overallProgressText || !currentFileInfo || !cancelUploadBtn ||
        !uploadSpeed || !uploadTimeRemaining || !toggleFileListBtn || !uploadFileList) {
        console.error('[Upload Init] 업로드 모달 요소를 찾을 수 없습니다. 업로드 UI가 동작하지 않을 수 있습니다.');
        return false;
    }
    
    // 초기 상태: 취소 버튼 비활성화
    cancelUploadBtn.disabled = true;
    
    // 파일 목록 토글 이벤트 리스너
    toggleFileListBtn.addEventListener('click', () => {
        toggleFileListBtn.classList.toggle('active');
        uploadFileList.classList.toggle('show');
    });
    
    const localFileUploadInput = document.getElementById('fileUpload'); 
    if (localFileUploadInput) {
        localFileUploadInput.addEventListener('change', async (event) => {
            const files = event.target.files;
            if (files.length === 0) {
                return;
            }

            const isPathLockedDefined = typeof isPathLocked === 'function';
            if (isPathLockedDefined && isPathLocked(currentPath)) { 
                console.warn(`[Upload] 현재 폴더 '${currentPath || '루트'}'가 잠겨 있어 업로드할 수 없습니다.`);
                if (typeof showToast === 'function') showToast('현재 폴더가 잠겨 있어 업로드할 수 없습니다.', 'warning');
                event.target.value = null; 
                return; 
            } else if (!isPathLockedDefined) {
                console.warn('[Upload] isPathLocked function not found. Proceeding without lock check.');
            }

            console.log(`[Upload] 파일 선택 버튼으로 ${files.length}개 파일 선택됨.`);

            const filesWithPaths = Array.from(files).map(file => {
                const normalizedName = file.name.normalize ? file.name.normalize('NFC') : file.name;
                const relativePath = file.webkitRelativePath ? (file.webkitRelativePath.normalize ? file.webkitRelativePath.normalize('NFC') : file.webkitRelativePath) : normalizedName;
                return {
                    file: file,
                    relativePath: relativePath
                }
            });

            await uploadFilesSequentially(filesWithPaths, currentPath);
            event.target.value = null;
        });
    } else {
        console.error('[Upload Init] 파일 업로드 입력 요소를 찾을 수 없습니다.');
        return false;
    }

    console.log('[Upload Init] 업로더 초기화 완료');
    return true;
};

// DOMContentLoaded 이벤트 리스너 내부 코드
document.addEventListener('DOMContentLoaded', () => {
    // 기타 초기화 로직은 여기서 실행 (필요한 경우)
    console.log('[Upload] DOMContentLoaded 이벤트 발생. 페이지 로드 완료.');
}); 