// frontend/upload.js
// --- 전역 변수 선언 ---

let isCancelled = false;
let isPaused = false;
let cancelledFiles = [];
let targetPath = '';
let completedFilesCount = 0; // 완료된 파일 수 추적
let initialTotalBytesToUpload = 0; // 전체 업로드 용량 (초기값)
let initialTotalFiles = 0; // 전체 파일 수 (초기값)

// --- 업로드 상태 관리 ---
let currentUploadXHRs = [];
let totalBytesToUpload = 0;
let totalBytesUploaded = 0;

// 업로드 속도 및 시간 계산 관련 변수
let startTime = 0;
let lastLoaded = 0;
let lastLoadTime = 0;
const speedHistory = [];
const SPEED_HISTORY_COUNT = 10;

// DOM 요소 변수 선언
let uploadProgressModal = null;
let overallProgressBar = null;
let overallProgressText = null;
let currentFileInfo = null;
let uploadSpeed = null;
let uploadTimeRemaining = null;
let totalUploadSizeEl = null;
let resumeUploadBtn = null;
let cancelUploadBtn = null;

// --- 업로드 모달 표시/숨김 ---
function showUploadModal(totalFiles = 0, completedFiles = 0) {
    if (!uploadProgressModal) uploadProgressModal = document.getElementById('upload-progress-modal');
    if (!overallProgressBar) overallProgressBar = document.getElementById('overall-progress-bar');
    if (!overallProgressText) overallProgressText = document.getElementById('overall-progress-text');
    if (!currentFileInfo) currentFileInfo = document.getElementById('current-file-info');
    if (!uploadSpeed) uploadSpeed = document.getElementById('upload-speed');
    if (!uploadTimeRemaining) uploadTimeRemaining = document.getElementById('upload-time-remaining');
    if (!totalUploadSizeEl) totalUploadSizeEl = document.getElementById('total-upload-size');
    if (!resumeUploadBtn) resumeUploadBtn = document.getElementById('resumeUploadBtn');
    if (!cancelUploadBtn) cancelUploadBtn = document.getElementById('cancelUploadBtn');
    
    if (!uploadProgressModal || !overallProgressBar || !overallProgressText || !currentFileInfo || !uploadSpeed || !uploadTimeRemaining || !totalUploadSizeEl || !resumeUploadBtn || !cancelUploadBtn) {
        logError('[Upload] 필수 모달 요소(#upload-progress-modal, ...)를 찾을 수 없습니다.');
        return;
    }

    isCancelled = false;
    isPaused = false;
    cancelledFiles = [];
    currentUploadXHRs = [];
    startTime = Date.now();
    lastLoaded = 0;
    lastLoadTime = startTime;
    speedHistory.length = 0;

    const overallPercent = initialTotalBytesToUpload > 0 ? Math.round((totalBytesUploaded / initialTotalBytesToUpload) * 100) : 0;
    overallProgressBar.style.width = `${overallPercent}%`;
    overallProgressText.textContent = `전체 진행률: ${overallPercent}% (${completedFilesCount}/${initialTotalFiles} 파일)`; // completedFilesCount 사용
    totalUploadSizeEl.textContent = `업로드: ${formatFileSize(totalBytesUploaded)} / ${formatFileSize(initialTotalBytesToUpload)}`;
    currentFileInfo.textContent = '대기 중...';
    uploadSpeed.textContent = '속도: 0 KB/s';
    uploadTimeRemaining.textContent = '남은 시간: 계산 중...';
    resumeUploadBtn.textContent = '중지';
    resumeUploadBtn.classList.remove('btn-success');
    resumeUploadBtn.classList.add('btn-warning');

    uploadProgressModal.style.display = 'flex';
}

function hideUploadModal() {
    if (uploadProgressModal) {
        uploadProgressModal.style.display = 'none';
    }
    logLog('[Upload] 업로드 모달 숨김');
    currentUploadXHRs = [];
}

// --- 업로드 속도 및 남은 시간 업데이트 함수 ---
function updateSpeedAndTime(currentFileLoaded, currentFileTotal) {
    if (isPaused || isCancelled) return;
    const now = Date.now();
    const elapsed = (now - lastLoadTime) / 1000;

    if (elapsed > 0.5) {
        const currentSpeed = (currentFileLoaded - lastLoaded) / elapsed;
        
        if (currentSpeed > 0 && isFinite(currentSpeed)) {
            speedHistory.push(currentSpeed);
            if (speedHistory.length > SPEED_HISTORY_COUNT) {
                speedHistory.shift();
            }
        }

        let weightedSpeed = 0;
        let totalWeight = 0;
        for (let i = 0; i < speedHistory.length; i++) {
            const weight = i + 1;
            weightedSpeed += speedHistory[i] * weight;
            totalWeight += weight;
        }
        
        const averageSpeed = totalWeight > 0 ? weightedSpeed / totalWeight : 0;

        const remainingBytes = Math.max(0, initialTotalBytesToUpload - totalBytesUploaded);
        let remainingTime = '';
        if (averageSpeed > 0 && remainingBytes > 0) {
            const secondsRemaining = Math.ceil(remainingBytes / averageSpeed);
            if (secondsRemaining < 60) {
                remainingTime = `${secondsRemaining}초`;
            } else if (secondsRemaining < 3600) {
                remainingTime = `${Math.floor(secondsRemaining / 60)}분 ${secondsRemaining % 60}초`;
            } else {
                remainingTime = `${Math.floor(secondsRemaining / 3600)}시간 ${Math.floor((secondsRemaining % 3600) / 60)}분`;
            }
        } else if (totalBytesUploaded >= initialTotalBytesToUpload && initialTotalBytesToUpload > 0) {
            remainingTime = '완료';
        } else {
            remainingTime = '계산 중...';
        }

        if (uploadSpeed && averageSpeed > 0) {
            uploadSpeed.textContent = `속도: ${formatFileSize(averageSpeed)}/s`;
        } else if (uploadSpeed) {
            uploadSpeed.textContent = '속도: 계산 중...';
        }
        
        if (uploadTimeRemaining) {
            uploadTimeRemaining.textContent = `남은 시간: ${remainingTime}`;
        }

        lastLoaded = currentFileLoaded;
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

// --- 전체 업로드 진행률 업데이트 ---
function updateUploadProgress(uploadedFileCount, totalFiles, currentFileRelativePath, currentFilePercent) {
    if (!overallProgressBar || !overallProgressText || !currentFileInfo) {
        return;
    }
    
    const overallPercent = initialTotalBytesToUpload > 0 ? Math.round((totalBytesUploaded / initialTotalBytesToUpload) * 100) : 0;
    
    overallProgressBar.style.width = `${overallPercent}%`;
    overallProgressText.textContent = `전체 진행률: ${overallPercent}% (${uploadedFileCount}/${totalFiles} 파일)`; 
    
    const displayPath = currentFileRelativePath ? currentFileRelativePath.replace(/\\/g, '/') : '...'; 
    currentFileInfo.textContent = `현재 파일: ${displayPath}`;

    if (totalUploadSizeEl) {
        totalUploadSizeEl.textContent = `업로드: ${formatFileSize(totalBytesUploaded)} / ${formatFileSize(initialTotalBytesToUpload)}`;
    }
}

// --- 개별 파일 업로드 함수 ---
async function uploadSingleFile(file, targetPath, relativePath, totalFiles, uploadedFileCounter) {
    return new Promise((resolve, reject) => {
        if (isCancelled || isPaused) {
            logLog(`[Upload] 시작 전 ${isPaused ? '중지' : '취소'}됨: ${relativePath}`);
            return resolve({ status: 'cancelled', file: relativePath });
        }

        const xhr = new XMLHttpRequest();
        currentUploadXHRs.push(xhr);
        const formData = new FormData();
        
        formData.append('file_0', file, encodeURIComponent(relativePath));
        formData.append('path', encodeURIComponent(targetPath));
        
        const fileInfo = [{
            originalName: file.name,
            relativePath: relativePath,
            size: file.size,
            index: 0
        }];
        formData.append('fileInfo', JSON.stringify(fileInfo));
        
        const uploadUrl = `${API_BASE_URL}/api/upload`;

        let fileBytesUploaded = 0;

        xhr.open('POST', uploadUrl, true);

        xhr.upload.onprogress = (event) => {
            if (isCancelled || isPaused) return;
            if (event.lengthComputable) {
                const currentFilePercent = Math.round((event.loaded / event.total) * 100);
                
                const deltaBytes = event.loaded - fileBytesUploaded;
                totalBytesUploaded += deltaBytes;
                fileBytesUploaded = event.loaded;
                
                updateUploadProgress(uploadedFileCounter.count, totalFiles, relativePath, currentFilePercent);
                
                updateSpeedAndTime(event.loaded, event.total);
            }
        };

        xhr.onload = () => {
            currentUploadXHRs = currentUploadXHRs.filter(x => x !== xhr);
            if (isCancelled || isPaused) {
                return resolve({ status: 'cancelled', file: relativePath });
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                logLog(`[Upload] 파일 업로드 성공: ${relativePath}`);
                totalBytesUploaded += file.size - fileBytesUploaded;
                resolve({ status: 'success', file: relativePath });
            } else {
                let errorMessage = `파일 업로드 실패: ${relativePath}`;
                if (xhr.getResponseHeader('Content-Type')?.includes('application/json')) {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        errorMessage = errorResponse.message || errorMessage;
                    } catch (e) {
                        logError(`[Upload] 응답 JSON 파싱 실패: ${relativePath}`);
                    }
                }
                reject({ status: 'failed', file: relativePath, error: new Error(errorMessage) });
            }
        };

        xhr.onerror = () => {
            currentUploadXHRs = currentUploadXHRs.filter(x => x !== xhr);
            if (isCancelled || isPaused) {
                return resolve({ status: 'cancelled', file: relativePath });
            }
            const errorMessage = navigator.onLine
                ? `네트워크 오류 발생: ${relativePath}`
                : `인터넷 연결이 끊겼습니다.`;
            logError(`[Upload] ${errorMessage}`);
            reject({ status: 'failed', file: relativePath, error: new Error(errorMessage) });
        };

        xhr.onabort = () => {
            currentUploadXHRs = currentUploadXHRs.filter(x => x !== xhr);
            logLog(`[Upload] 업로드 중단됨 (onabort): ${relativePath}`);
            resolve({ status: 'cancelled', file: relativePath });
        };

        logLog(`[Upload] 업로드 시작: ${relativePath} -> ${targetPath}`);
        xhr.send(formData);
    });
}

// --- 병렬 파일 업로드 관리 함수 ---
async function uploadFilesSequentially(filesWithPaths, uploadTargetPath, isResume = false) {
    targetPath = uploadTargetPath;

    if (!isResume) {
        // 신규 업로드: 전체 파일 수 및 용량 초기화
        initialTotalFiles = filesWithPaths.length;
        completedFilesCount = 0;
        totalBytesUploaded = 0;
        initialTotalBytesToUpload = filesWithPaths.reduce((sum, { file }) => sum + file.size, 0);
        totalBytesToUpload = initialTotalBytesToUpload;
    } else {
        // 재개: 기존 완료 파일 수 유지, 남은 파일의 용량만 계산
        totalBytesToUpload = filesWithPaths.reduce((sum, { file }) => sum + file.size, 0);
        // initialTotalFiles는 유지
    }

    const totalFiles = initialTotalFiles;
    if (filesWithPaths.length === 0 && !isResume) {
        logLog('[Upload] 업로드할 파일 없음.');
        hideUploadModal();
        if (typeof showToast === 'function') showToast('업로드할 파일이 없습니다.', 'info');
        return;
    }

    showUploadModal(totalFiles, completedFilesCount);

    let successCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    const failedFiles = [];
    let uploadedFileCounter = { count: completedFilesCount }; // 재개 시 기존 완료 수로 초기화

    if (totalUploadSizeEl) {
        totalUploadSizeEl.textContent = `업로드: ${formatFileSize(totalBytesUploaded)} / ${formatFileSize(initialTotalBytesToUpload)}`;
    }

    logLog(`[Upload Parallel] 총 ${totalFiles}개 파일 병렬 업로드 시작 (남은 파일: ${filesWithPaths.length}, 완료: ${completedFilesCount}). 대상 경로: ${targetPath}`);

    const CONCURRENT_UPLOADS = 5;
    const queue = [...filesWithPaths];
    const activeUploads = [];
    const results = [];

    let finishCallback = null;
    const allUploadsFinishedPromise = new Promise(resolve => {
        finishCallback = resolve;
    });

    async function runNextUpload() {
        if (isCancelled || isPaused || queue.length === 0) {
            if (isPaused) {
                // 중지 시 대기열과 진행 중인 파일을 cancelledFiles에 저장
                cancelledFiles = [...queue];
                for (const uploadPromise of activeUploads) {
                    const result = await uploadPromise;
                    if (result.status === 'cancelled' && result.file) {
                        const originalFile = filesWithPaths.find(f => f.relativePath === result.file);
                        if (originalFile) {
                            cancelledFiles.push(originalFile);
                        }
                    }
                }
                logLog(`[Upload] 중지됨. 완료: ${completedFilesCount}/${initialTotalFiles}, cancelledFiles에 ${cancelledFiles.length}개 파일 저장: ${cancelledFiles.map(f => f.relativePath).join(', ')}`);
                if (typeof showToast === 'function') {
                    showToast('업로드가 중지되었습니다.', 'info');
                }
            }
            checkCompletion();
            return;
        }

        if (activeUploads.length >= CONCURRENT_UPLOADS) {
            return;
        }

        const { file, relativePath } = queue.shift();

        const uploadPromise = uploadSingleFile(file, targetPath, relativePath, totalFiles, uploadedFileCounter)
            .then(result => {
                results.push(result);
                if (result.status === 'success') {
                    uploadedFileCounter.count++;
                    completedFilesCount++; // 성공 시 전역 카운터 증가
                }
                return result;
            })
            .catch(errorResult => {
                results.push(errorResult);
                return errorResult;
            })
            .finally(() => {
                const index = activeUploads.indexOf(uploadPromise);
                if (index > -1) {
                    activeUploads.splice(index, 1);
                }
                runNextUpload();
            });

        activeUploads.push(uploadPromise);
        setTimeout(runNextUpload, 0);
    }

    for (let i = 0; i < Math.min(CONCURRENT_UPLOADS, queue.length); i++) {
        runNextUpload();
    }

    function checkCompletion() {
        if (activeUploads.length === 0 && queue.length === 0) {
            finishCallback();
        }
    }

    await allUploadsFinishedPromise;

    results.forEach(result => {
        if (result.status === 'success') {
            successCount++;
            // completedFilesCount는 uploadPromise 내에서 이미 증가
        } else if (result.status === 'failed') {
            failedCount++;
            failedFiles.push(result.file || '알 수 없는 파일');
            logError(`[Upload Parallel] 파일 업로드 실패: ${result.file}`, result.error);
        } else if (result.status === 'cancelled') {
            cancelledCount++;
        }
    });

    if (isPaused) {
        return; // 모달 유지
    } else if (isCancelled) {
        cancelledCount += queue.length;
        cancelledFiles = [];
        queue.length = 0;
        // completedFilesCount는 유지
        initialTotalFiles = 0;
        initialTotalBytesToUpload = 0;
        hideUploadModal();
    } else {
        cancelledFiles = [];
        hideUploadModal();
    }

    if (typeof showToast === 'function') {
        let finalMessage = '';
        let messageType = 'info';

        if (failedCount > 0) {
            finalMessage = `${successCount}개 성공, ${failedCount}개 실패.`;
            if (cancelledCount > 0) finalMessage += ` ${cancelledCount}개 취소.`;
            finalMessage += ` 실패 목록: ${failedFiles.join(', ')}`.substring(0, 200);
            messageType = 'warning';
        } else if (cancelledCount > 0 && !isPaused) {
            finalMessage = `업로드가 취소되었습니다. (${completedFilesCount}/${totalFiles} 완료)`;
            messageType = 'warning';
        } else if (completedFilesCount === totalFiles && totalFiles > 0) {
            finalMessage = `${totalFiles}개 파일 업로드를 완료했습니다.`;
            messageType = 'success';
        } else {
            finalMessage = `업로드 작업 완료 (${successCount} 성공, ${failedCount} 실패, ${cancelledCount} 취소)`;
            messageType = 'info';
        }

        if (finalMessage) {
            showToast(finalMessage, messageType, failedCount > 0 ? 10000 : 5000);
        }
    }

    if (typeof loadFiles === 'function' && (successCount > 0 || failedCount > 0)) {
        let refreshDelay = totalFiles <= 100 ? 300 : totalFiles <= 1000 ? 1000 : 2000;
        setTimeout(() => {
            logLog(`[Upload] 업로드 완료/실패 후 파일 목록 새로고침 시작 (파일 수: ${totalFiles}, 대기 시간: ${refreshDelay}ms)`);
            loadFiles(typeof currentPath !== 'undefined' ? currentPath : '');
        }, refreshDelay);
    } else {
        logLog('[Upload] 파일 목록 새로고침 건너뜀 (성공/실패 파일 없음).');
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
                logError("파일 접근 오류:", path + entry.name, err);
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
                    logError("하위 디렉토리 처리 오류:", currentDirPath, err);
                    reject(err);
                }
            }, err => {
                logError("디렉토리 읽기 오류:", path + entry.name, err);
                reject(err);
            });
        });
    }
}

// --- 외부 파일 드롭 처리 함수 ---
window.handleExternalFileDrop = async (e, targetFolderItem = null) => {
    logLog('[Upload] handleExternalFileDrop 시작');
    try {
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) {
            logLog('[Upload] 드롭된 항목이 없습니다.');
            return;
        }

        const currentPath = typeof window.currentPath !== 'undefined' ? window.currentPath : '';
        const showLoading = typeof window.showLoading === 'function' ? window.showLoading : null;
        const hideLoading = typeof window.hideLoading === 'function' ? window.hideLoading : null;
        const showToast = typeof window.showToast === 'function' ? window.showToast : null;
        const isPathLocked = typeof window.isPathLocked === 'function' ? window.isPathLocked : null;

        let targetPathLocal = currentPath;

        if (targetFolderItem && typeof targetFolderItem.getAttribute === 'function' && targetFolderItem.hasAttribute('data-name')) {
            const folderName = targetFolderItem.getAttribute('data-name');
            const potentialTargetPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            if (isPathLocked && isPathLocked(potentialTargetPath)) {
                logWarn(`[Upload] 잠긴 폴더 '${folderName}'(으)로는 업로드할 수 없습니다.`);
                if (showToast) showToast(`잠긴 폴더 '${folderName}'(으)로는 업로드할 수 없습니다.`, 'warning');
                return;
            }
            targetPathLocal = potentialTargetPath;
        }

        if (showLoading) showLoading();

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
                logError('[Upload] 파일 트리 순회 중 최종 오류:', treeError);
                if (showToast) showToast('폴더 구조를 읽는 중 오류가 발생했습니다.', 'error');
                if (hideLoading) hideLoading();
                return;
            }
        }

        if (hideLoading) hideLoading();

        if (filesWithPaths.length === 0) {
            logLog('[Upload] 업로드할 파일을 찾을 수 없습니다.');
            if (showToast) showToast('업로드할 파일을 찾을 수 없습니다.', 'warning');
            return;
        }

        logLog(`[Upload] 총 ${filesWithPaths.length}개의 파일 수집 완료. 병렬 업로드 시작.`);
        await uploadFilesSequentially(filesWithPaths, targetPathLocal);

    } catch (error) {
        logError('[Upload] 외부 파일 드롭 처리 중 예상치 못한 오류:', error);
        const hideLoading = typeof window.hideLoading === 'function' ? window.hideLoading : null;
        const showToast = typeof window.showToast === 'function' ? window.showToast : null;
        if (showToast) showToast(`파일 드롭 처리 중 오류 발생: ${error.message}`, 'error');
        if (hideLoading) hideLoading();
    }
};

// --- 업로드 취소 함수 ---
function cancelUpload() {
    isCancelled = true;
    isPaused = false;
    logLog('[Upload] 업로드 취소 요청됨.');

    currentUploadXHRs.forEach(xhr => {
        if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
            xhr.abort();
            logLog('[Upload] 진행 중인 XHR 요청 취소됨.');
        }
    });
    currentUploadXHRs = [];
    cancelledFiles = [];
    completedFilesCount = 0;
    initialTotalFiles = 0;
    totalBytesToUpload = 0;
    totalBytesUploaded = 0;
    initialTotalBytesToUpload = 0;
    speedHistory.length = 0;

    hideUploadModal();
    if (typeof showToast === 'function') {
        showToast('업로드가 취소되었습니다.', 'info');
    }
    setTimeout(() => {
        loadFiles(typeof currentPath !== 'undefined' ? currentPath : '');
    }, 300);
}

// --- 업로드 중지/재개 함수 ---
function toggleUpload() {
    if (!isPaused) {
        // 중지 로직
        isPaused = true;
        logLog('[Upload] 업로드 중지 요청됨.');

        currentUploadXHRs.forEach(xhr => {
            if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
                xhr.abort();
                logLog('[Upload] 진행 중인 XHR 요청 중지됨.');
            }
        });
        currentUploadXHRs = [];

        if (resumeUploadBtn) {
            resumeUploadBtn.textContent = '재개';
            resumeUploadBtn.classList.remove('btn-warning');
            resumeUploadBtn.classList.add('btn-success');
        }
    } else {
        // 재개 로직
        if (cancelledFiles.length === 0) {
            logError('[Upload] 재개 시도: cancelledFiles가 비어 있음.');
            if (typeof showToast === 'function') {
                showToast('재개할 파일이 없습니다.', 'info');
            }
            return;
        }

        logLog(`[Upload] 업로드 재개. ${cancelledFiles.length}개 파일 재개 (완료: ${completedFilesCount}/${initialTotalFiles}): ${cancelledFiles.map(f => f.relativePath).join(', ')}`);
        isPaused = false;
        const filesToResume = [...cancelledFiles];

        if (resumeUploadBtn) {
            resumeUploadBtn.textContent = '중지';
            resumeUploadBtn.classList.remove('btn-success');
            resumeUploadBtn.classList.add('btn-warning');
        }

        // completedFilesCount 유지 및 재개 호출
        uploadFilesSequentially(filesToResume, targetPath, true);
    }
}

// --- 초기화 함수 ---
window.initializeUploader = function() {
    logLog('[Upload Init] 업로더 초기화 시작...');
    
    const localFileUploadInput = document.getElementById('fileUpload');
    if (localFileUploadInput) {
        localFileUploadInput.addEventListener('change', async (event) => {
            const files = event.target.files;
            if (!files || files.length === 0) {
                return;
            }

            const currentPath = typeof window.currentPath !== 'undefined' ? window.currentPath : '';
            
            logLog(`[Upload] ${files.length}개 파일 선택됨.`);
            const filesWithPaths = Array.from(files).map(file => {
                const normalizedName = file.name.normalize ? file.name.normalize('NFC') : file.name;
                const relativePath = file.webkitRelativePath 
                    ? (file.webkitRelativePath.normalize ? file.webkitRelativePath.normalize('NFC') : file.webkitRelativePath) 
                    : normalizedName;
                return { file, relativePath };
            });

            await uploadFilesSequentially(filesWithPaths, currentPath);
            event.target.value = null;
        });
    } else {
        logWarn('[Upload Init] 파일 업로드 입력(#fileUpload)을 찾을 수 없습니다.');
    }
    
    const cancelUploadBtnLocal = document.getElementById('cancelUploadBtn');
    if (cancelUploadBtnLocal) {
        cancelUploadBtnLocal.addEventListener('click', () => {
            logLog('[Upload] 취소 버튼 클릭.');
            cancelUpload();
        });
    } else {
        logWarn('[Upload Init] 취소 버튼(#cancelUploadBtn)을 찾을 수 없습니다.');
    }
    
    const resumeUploadBtnLocal = document.getElementById('resumeUploadBtn');
    if (resumeUploadBtnLocal) {
        resumeUploadBtnLocal.addEventListener('click', () => {
            logLog('[Upload] 중지/재개 버튼 클릭.');
            toggleUpload();
        });
    } else {
        logWarn('[Upload Init] 중지/재개 버튼(#resumeUploadBtn)을 찾을 수 없습니다.');
    }
    
    logLog('[Upload Init] 업로더 초기화 완료.');
    return true;
};

// DOMContentLoaded 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    logLog('[Upload] DOMContentLoaded 이벤트 발생. 페이지 로드 완료.');
});