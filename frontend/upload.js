// frontend/upload.js
// --- 전역 변수 선언 ---

let isCancelled = false;

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

// DOM 요소 변수 선언 (초기값 null)
let uploadProgressModal = null;
let overallProgressBar = null;
let overallProgressText = null;
let currentFileInfo = null;
let uploadSpeed = null;
let uploadTimeRemaining = null;
let totalUploadSizeEl = null; // 총 용량 표시 요소

// --- 업로드 모달 표시/숨김 ---
function showUploadModal() {
    if (!uploadProgressModal) uploadProgressModal = document.getElementById('upload-progress-modal');
    if (!overallProgressBar) overallProgressBar = document.getElementById('overall-progress-bar');
    if (!overallProgressText) overallProgressText = document.getElementById('overall-progress-text');
    if (!currentFileInfo) currentFileInfo = document.getElementById('current-file-info');
    if (!uploadSpeed) uploadSpeed = document.getElementById('upload-speed');
    if (!uploadTimeRemaining) uploadTimeRemaining = document.getElementById('upload-time-remaining');
    if (!totalUploadSizeEl) totalUploadSizeEl = document.getElementById('total-upload-size');
    
    // 필수 요소 확인 (totalUploadSizeEl 추가)
    if (!uploadProgressModal || !overallProgressBar || !overallProgressText || !currentFileInfo || !uploadSpeed || !uploadTimeRemaining || !totalUploadSizeEl) {
        logError('[Upload] 필수 모달 요소(#upload-progress-modal, ...)를 찾을 수 없습니다.');
        return;
    }

    isCancelled = false;
    totalBytesToUpload = 0;
    totalBytesUploaded = 0;
    startTime = Date.now();
    lastLoaded = 0;
    lastLoadTime = startTime;
    speedHistory.length = 0; 
    currentUploadXHRs = []; 

    // 초기 상태 설정 (총 용량 추가)
    if (overallProgressBar) overallProgressBar.style.width = '0%';
    if (overallProgressText) overallProgressText.textContent = '0% (0/0)';
    if (totalUploadSizeEl) totalUploadSizeEl.textContent = '업로드: 0 B / 0 B'; // 초기 텍스트 설정
    if (currentFileInfo) currentFileInfo.textContent = '대기 중...';
    if (uploadSpeed) uploadSpeed.textContent = '속도: 0 KB/s';
    if (uploadTimeRemaining) uploadTimeRemaining.textContent = '남은 시간: 계산 중...';

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
// (파일 인덱스 관련 파라미터 제거, totalBytesUploaded 직접 사용하도록 수정)
let cachedAverageSpeed = 0;
function updateSpeedAndTime(currentFileLoaded, currentFileTotal) {
    const now = Date.now();
    const elapsed = (now - lastLoadTime) / 1000; // 초 단위 경과 시간

    if (elapsed > 0.5) { // 0.5초마다 업데이트
        const currentSpeed = (currentFileLoaded - lastLoaded) / elapsed; // 현재 파일의 순간 속도
        
        // 속도 기록 업데이트
        if (currentSpeed > 0 && isFinite(currentSpeed)) {
            speedHistory.push(currentSpeed);
            if (speedHistory.length > SPEED_HISTORY_COUNT) {
                speedHistory.shift();
            }
        }

        // 가중 평균 속도 계산
        let weightedSpeed = 0;
        let totalWeight = 0;
        for (let i = 0; i < speedHistory.length; i++) {
            const weight = i + 1; // 최근 값에 더 큰 가중치
            weightedSpeed += speedHistory[i] * weight;
            totalWeight += weight;
        }
        
        const averageSpeed = totalWeight > 0 ? weightedSpeed / totalWeight : 0; // 안전한 분모 체크

        // 남은 바이트 및 시간 계산
        const remainingBytes = Math.max(0, totalBytesToUpload - totalBytesUploaded);
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
        } else if (totalBytesUploaded === totalBytesToUpload && totalBytesToUpload > 0) {
            remainingTime = '완료';
        } else {
            remainingTime = '계산 중...';
        }

        // UI 업데이트
        if (uploadSpeed && averageSpeed > 0) {
            uploadSpeed.textContent = `속도: ${formatFileSize(averageSpeed)}/s`;
        } else if (uploadSpeed) {
            uploadSpeed.textContent = '속도: 계산 중...';
        }
        
        if (uploadTimeRemaining) {
            uploadTimeRemaining.textContent = `남은 시간: ${remainingTime}`;
        }

        // 마지막 측정 값 업데이트
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
// (파일 인덱스 대신 업로드된 파일 수와 바이트 기반으로 수정)
function updateUploadProgress(uploadedFileCount, totalFiles, currentFileRelativePath, currentFilePercent) {
    // DOM 요소가 아직 할당되지 않았을 수 있으므로 확인
    if (!overallProgressBar || !overallProgressText || !currentFileInfo) {
        // 모달 표시 함수에서 DOM 요소를 가져오므로, 여기서는 로그만 남김
        // logWarn('[Upload] Progress UI elements not ready for update.');
        return;
    }
    
    const overallPercent = totalBytesToUpload > 0 ? Math.round((totalBytesUploaded / totalBytesToUpload) * 100) : 0;
    
    overallProgressBar.style.width = `${overallPercent}%`;
    overallProgressText.textContent = `전체 진행률: ${overallPercent}% (${uploadedFileCount}/${totalFiles} 파일)`; 
 
    
    // 현재 파일 정보 업데이트 (폴더 경로 포함)
    // currentFileRelativePath가 빈 문자열일 경우 처리
    const displayPath = currentFileRelativePath ? currentFileRelativePath.replace(/\\/g, '/') : '...'; 
    currentFileInfo.textContent = `현재 파일: ${displayPath}`;

    // 업로드된 용량 / 총 용량 업데이트
    if (totalUploadSizeEl) {
        totalUploadSizeEl.textContent = `업로드: ${formatFileSize(totalBytesUploaded)} / ${formatFileSize(totalBytesToUpload)}`;
    }
    const fileList = document.getElementById('upload-file-list');
    if (fileList) {
        const li = document.createElement('li');
        li.textContent = `${currentFileRelativePath}: ${currentFilePercent}%`;
        fileList.appendChild(li);
    }    
}

// --- 개별 파일 업로드 함수 (XMLHttpRequest 사용) ---
// (fileIndex 파라미터 제거, totalBytesUploaded 업데이트 로직 추가)
async function uploadSingleFile(file, targetPath, relativePath, totalFiles, uploadedFileCounter) { // fileIndex 대신 uploadedFileCounter 사용
    return new Promise((resolve, reject) => {
        if (isCancelled) {
            logLog(`[Upload] 시작 전 취소됨: ${relativePath}`);
            return resolve({ status: 'cancelled', file: relativePath });
        }

        const xhr = new XMLHttpRequest();
        currentUploadXHRs.push(xhr); // 진행 중인 XHR 목록에 추가
        const formData = new FormData();
        
        formData.append('file_0', file, encodeURIComponent(relativePath));
        formData.append('path', encodeURIComponent(targetPath));
        
        const fileInfo = [{
            originalName: file.name,
            relativePath: relativePath,
            size: file.size,
            index: 0 // 단일 파일 처리 시 index는 0으로 고정될 수 있음
        }];
        formData.append('fileInfo', JSON.stringify(fileInfo));
        
        const uploadUrl = `${API_BASE_URL}/api/upload`; 

        let fileBytesUploaded = 0; // 이 파일로 인해 업로드된 바이트 추적

        xhr.open('POST', uploadUrl, true);

        xhr.upload.onprogress = (event) => {
            if (isCancelled) return;
            if (event.lengthComputable) {
                const currentFilePercent = Math.round((event.loaded / event.total) * 100);
                
                // 전체 업로드된 바이트 업데이트
                const deltaBytes = event.loaded - fileBytesUploaded;
                totalBytesUploaded += deltaBytes;
                fileBytesUploaded = event.loaded;
                
                // 전체 진행률 업데이트 (업로드 완료된 파일 수 전달)
                updateUploadProgress(uploadedFileCounter.count, totalFiles, relativePath, currentFilePercent);
                
                // 속도 및 남은 시간 업데이트 (현재 파일 기준)
                updateSpeedAndTime(event.loaded, event.total);
            }
        };

        xhr.onload = () => {
            currentUploadXHRs = currentUploadXHRs.filter(x => x !== xhr);
            if (isCancelled) {
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
            if (isCancelled) {
                return resolve({ status: 'cancelled', file: relativePath });
            }
            const errorMessage = navigator.onLine
                ? `네트워크 오류 발생: ${relativePath}`
                : `인터넷 연결이 끊겼습니다.`;
            logError(`[Upload] ${errorMessage}`);
            reject({ status: 'failed', file: relativePath, error: new Error(errorMessage) });
        };

        xhr.onabort = () => {
            currentUploadXHRs = currentUploadXHRs.filter(x => x !== xhr); // XHR 목록에서 제거
            logLog(`[Upload] 업로드 중단됨 (onabort): ${relativePath}`);
            resolve({ status: 'cancelled', file: relativePath });
        };

        logLog(`[Upload] 업로드 시작: ${relativePath} -> ${targetPath}`);
        xhr.send(formData);
    });
}

// --- 병렬 파일 업로드 관리 함수 (파일 목록 요약 로그 추가) ---
async function uploadFilesSequentially(filesWithPaths, targetPath) {
    showUploadModal(); // 모달 표시 및 변수 초기화

    const totalFiles = filesWithPaths.length;
    if (totalFiles === 0) {
        logLog('[Upload] 업로드할 파일 없음.');
        hideUploadModal();
        if (typeof showToast === 'function') showToast('업로드할 파일이 없습니다.', 'info');
        return;
    }

    // 전체 업로드할 바이트 계산 및 초기화
    totalBytesToUpload = filesWithPaths.reduce((sum, { file }) => sum + file.size, 0);
    totalBytesUploaded = 0;

    // ... (로그 전송 로직은 유지)

    let successCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    const failedFiles = [];
    let uploadedFileCounter = { count: 0 };

    if (totalUploadSizeEl) {
        totalUploadSizeEl.textContent = `업로드: 0 B / ${formatFileSize(totalBytesToUpload)}`;
    }

    logLog(`[Upload Parallel] 총 ${totalFiles}개 파일 병렬 업로드 시작. 대상 경로: ${targetPath}`);

    const CONCURRENT_UPLOADS = 5;
    const queue = [...filesWithPaths]; // 업로드 대기열
    const activeUploads = [];
    const results = [];

    let finishCallback = null;
    const allUploadsFinishedPromise = new Promise(resolve => {
        finishCallback = resolve;
    });

    function checkCompletion() {
        if (queue.length === 0 && activeUploads.length === 0 && finishCallback) {
            finishCallback();
        }
    }

    function runNextUpload() {
        if (isCancelled || queue.length === 0) {
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
                if (result.status === 'success') uploadedFileCounter.count++;
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

    for (let i = 0; i < CONCURRENT_UPLOADS && queue.length > 0; i++) {
        runNextUpload();
    }

    await allUploadsFinishedPromise;

    // 결과 처리
    results.forEach(result => {
        if (result.status === 'success') {
            successCount++;
        } else if (result.status === 'failed') {
            failedCount++;
            failedFiles.push(result.file || '알 수 없는 파일');
            logError(`[Upload Parallel] 파일 업로드 실패: ${result.file}`, result.error);
        } else if (result.status === 'cancelled') {
            cancelledCount++;
        }
    });

    // 취소 시 대기열에 남은 파일 처리
    if (isCancelled) {
        cancelledCount += queue.length; // 대기열에 남은 파일을 취소된 것으로 간주
        queue.length = 0; // 대기열 비우기
    }

    hideUploadModal();

    // 최종 결과 알림
    if (typeof showToast === 'function') {
        let finalMessage = '';
        let messageType = 'info';

        if (failedCount > 0) {
            finalMessage = `${successCount}개 성공, ${failedCount}개 실패.`;
            if (cancelledCount > 0) finalMessage += ` ${cancelledCount}개 취소.`;
            finalMessage += ` 실패 목록: ${failedFiles.join(', ')}`.substring(0, 200);
            messageType = 'warning';
        } else if (cancelledCount > 0) {
            finalMessage = `업로드가 취소되었습니다. (${successCount}/${totalFiles} 완료)`;
            messageType = 'warning';
        } else if (successCount === totalFiles && totalFiles > 0) {
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

    // 파일 목록 새로고침
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

// --- 외부 파일 드롭 처리 함수 (handleExternalFileDrop) ---
// (내부 로직은 변경 없음, uploadFilesSequentially 호출)
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

        let targetPath = currentPath; 
        let targetName = '현재 폴더';

        if (targetFolderItem && typeof targetFolderItem.getAttribute === 'function' && targetFolderItem.hasAttribute('data-name')) {
            const folderName = targetFolderItem.getAttribute('data-name');
            const potentialTargetPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            if (isPathLocked && isPathLocked(potentialTargetPath)) {
                logWarn(`[Upload] 잠긴 폴더 '${folderName}'(으)로는 업로드할 수 없습니다.`);
                if (showToast) showToast(`잠긴 폴더 '${folderName}'(으)로는 업로드할 수 없습니다.`, 'warning');
                return; 
            
            } else if (!isPathLocked){
                logWarn('[Upload] isPathLocked 함수 없음. 현재 폴더 잠금 확인 없이 진행.');
            }
            logLog('[Upload] 외부 파일 드래그 감지: 현재 경로(', targetPath || '루트' ,')에 업로드');
        }

        if (showLoading) showLoading(); 
        else logWarn('[Upload] showLoading 함수를 찾을 수 없습니다.');

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
                if (showToast) showToast('폴더 구조를 읽는 중 오류가 발생했습니다. 구조가 너무 긴 경우 읽을 수 없습니다.', 'error');
                if (hideLoading) hideLoading();
                return; 
            }
        }

        if (hideLoading) hideLoading(); 
        else logWarn('[Upload] hideLoading 함수를 찾을 수 없습니다.');

        if (filesWithPaths.length === 0) {
            logLog('[Upload] 업로드할 파일을 찾을 수 없습니다.');
            if (showToast) showToast('업로드할 파일을 찾을 수 없습니다.', 'warning');
            return;
        }

        logLog(`[Upload] 총 ${filesWithPaths.length}개의 파일 수집 완료. 병렬 업로드 시작.`);
        await uploadFilesSequentially(filesWithPaths, targetPath); // 변경된 함수 호출

    } catch (error) {
        logError('[Upload] 외부 파일 드롭 처리 중 예상치 못한 오류:', error);
        const hideLoading = typeof window.hideLoading === 'function' ? window.hideLoading : null;
        const showToast = typeof window.showToast === 'function' ? window.showToast : null;
        if (showToast) showToast(`파일 드롭 처리 중 오류 발생: ${error.message}`, 'error');
        if (hideLoading) hideLoading(); 
    } 
};

// --- 업로드 취소 함수 --- 
let cancelledFiles = [];
function cancelUpload() {
    isCancelled = true;
    logLog('[Upload] 업로드 취소 요청됨.');

    // 현재 진행 중인 모든 XHR 요청 취소
    currentUploadXHRs.forEach(xhr => {
        if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
            xhr.abort();
            logLog('[Upload] 진행 중인 XHR 요청 취소됨.');
        }
    });
    currentUploadXHRs = []; // 배열 비우기

    // 상태 초기화
    totalBytesToUpload = 0;
    totalBytesUploaded = 0;
    speedHistory.length = 0;
}

async function resumeUpload() {
    if (cancelledFiles.length === 0) return;
    isCancelled = false;
    await uploadFilesSequentially(cancelledFiles, targetPath);
    cancelledFiles = [];
}

// --- 초기화 함수 (initializeUploader) ---
window.initializeUploader = function() {
    logLog('[Upload Init] 업로더 초기화 시작...');
    
    // 파일 선택 이벤트 리스너
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
    
    // 취소 버튼 이벤트 리스너
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    if (cancelUploadBtn) {
        cancelUploadBtn.addEventListener('click', () => {
            cancelUpload();
            logLog('[Upload] 취소 버튼 클릭으로 업로드 중단.');
            hideUploadModal();
            if (typeof showToast === 'function') {
                showToast('업로드가 취소되었습니다.', 'info');
            }
        });
    } else {
        logWarn('[Upload Init] 취소 버튼(#cancelUploadBtn)을 찾을 수 없습니다.');
    }
    
    logLog('[Upload Init] 업로더 초기화 완료.');
    return true;
};

// DOMContentLoaded 이벤트 리스너 내부 코드
document.addEventListener('DOMContentLoaded', () => {
    // 기타 초기화 로직은 여기서 실행 (필요한 경우)
    logLog('[Upload] DOMContentLoaded 이벤트 발생. 페이지 로드 완료.');
}); 