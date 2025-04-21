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
    /*
    if (!uploadProgressModal || !overallProgressBar || !overallProgressText || !currentFileInfo || !uploadSpeed || !uploadTimeRemaining || !totalUploadSizeEl || !resumeUploadBtn || !cancelUploadBtn) {
        logError('[Upload] 필수 모달 요소(#upload-progress-modal, ...)를 찾을 수 없습니다.');
        return;
    }
*/
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
        
        // 원본 파일 날짜 정보 추가
        const fileInfo = [{
            originalName: file.name,
            relativePath: relativePath,
            size: file.size,
            lastModified: file.lastModified, // 파일 수정 시간 추가
            index: 0
        }];
        formData.append('fileInfo', JSON.stringify(fileInfo));
        
        const uploadUrl = `${API_BASE_URL}/explorer-api/upload`;

        let fileBytesUploaded = 0;

        xhr.open('POST', uploadUrl, true);

        xhr.upload.onprogress = (event) => {
            if (isCancelled || isPaused) return;
            if (event.lengthComputable) {
                const currentFilePercent = Math.round((event.loaded / event.total) * 100);
                
                const deltaBytes = event.loaded - fileBytesUploaded;
                totalBytesUploaded += deltaBytes;
                fileBytesUploaded = event.loaded;
                
                updateUploadProgress(uploadedFileCounter.count+1, totalFiles, relativePath, currentFilePercent);
                
                updateSpeedAndTime(event.loaded, event.total);
            }
        };

        // 여기에 타임아웃 코드를 추가해야 합니다
        // 아래 코드를 추가하세요:
        xhr.timeout = 6000000; // 100분 = 600,000 밀리초

        xhr.ontimeout = () => {
            currentUploadXHRs = currentUploadXHRs.filter(x => x !== xhr);
            const errorMessage = `업로드 시간이 초과되었습니다: ${relativePath}`;
            logError(`[Upload] ${errorMessage}`);
            reject({ status: 'failed', file: relativePath, error: new Error(errorMessage) });
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

// --- 병렬 파일 업로드 관리 함수 (Netlify 환경에서는 순차 처리) ---
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

    logLog(`[Upload Manager] 총 ${totalFiles}개 파일 업로드 시작 (남은 파일: ${filesWithPaths.length}, 완료: ${completedFilesCount}). 대상 경로: ${targetPath}`);

    let CONCURRENT_UPLOADS = 3; // 기본값
    const queue = [...filesWithPaths];
    const activeUploads = [];
    const results = [];

    // Netlify 환경 감지 및 동시 업로드 수 조정
    const isNetlify = window.location.hostname.includes('netlify.app');
    if (isNetlify) {
        logLog('[Upload] Netlify 환경 감지됨. 동시 업로드 수를 1로 제한합니다.');
        CONCURRENT_UPLOADS = 1;
    } else {
        // Netlify가 아닌 경우 기존 로직 적용 (파일 크기 기반 동시 업로드 수 결정)
        if (filesWithPaths.length > 0) { // 파일이 있을 때만 maxFileSize 계산
            try {
                const maxFileSize = Math.max(...filesWithPaths.map(f => f.file.size));
                if (maxFileSize > 500 * 1024 * 1024) { // 500MB 이상
                    CONCURRENT_UPLOADS = 2;
                } else if (maxFileSize > 100 * 1024 * 1024) { // 100MB 이상
                    CONCURRENT_UPLOADS = 3;
                } else { // 100MB 미만
                    CONCURRENT_UPLOADS = 4;
                }
                logLog(`[Upload] 최대 파일 크기 ${formatFileSize(maxFileSize)}, 동시 업로드 수: ${CONCURRENT_UPLOADS}`);
            } catch (e) {
                logError('[Upload] maxFileSize 계산 오류:', e);
                CONCURRENT_UPLOADS = 3; // 오류 발생 시 기본값 사용
            }
        } else {
            CONCURRENT_UPLOADS = 1; // 업로드할 파일이 없으면 1로 설정 (무의미하지만 안전)
        }
    }


    let finishCallback = null;
    const allUploadsFinishedPromise = new Promise(resolve => {
        finishCallback = resolve;
    });

    async function runNextUpload() {
        if (isCancelled || isPaused) { // || queue.length === 0 <- 이 조건은 checkCompletion에서 처리
            if (isPaused) {
                // 중지 시 대기열과 진행 중인 파일을 cancelledFiles에 저장
                cancelledFiles = [...queue]; // 남은 대기열 추가
                logLog(`[Upload] 중지됨. 대기열 ${queue.length}개 저장됨.`);
                // 활성 업로드 중단 시도는 uploadSingleFile의 onabort/onload에서 처리

                // 활성 업로드 작업들이 완료되거나 중단될 때까지 기다릴 필요는 없음
                // 중지 버튼 누르면 즉시 상태 업데이트하고 모달 유지

                if (typeof showToast === 'function') {
                    showToast('업로드가 중지되었습니다.', 'info');
                }
                // 중지 상태에서는 checkCompletion을 호출하여 Promise를 resolve하지 않음
                return; // 여기서 중지
            }

            // 취소된 경우 (isCancelled = true)
             logLog(`[Upload] 취소됨. 활성 업로드 ${activeUploads.length}개, 대기열 ${queue.length}개 남음.`);
             // 취소 시에도 진행 중인 XHR은 abort() 호출 (cancelUpload 함수에서 처리)
             checkCompletion(); // 취소 시에는 완료 처리 로직으로 넘어감
             return;
        }


        // 동시성 제어 및 큐 소모
        while (activeUploads.length < CONCURRENT_UPLOADS && queue.length > 0) {
            const { file, relativePath } = queue.shift();

            const uploadPromise = uploadSingleFile(file, targetPath, relativePath, totalFiles, uploadedFileCounter)
                .then(result => {
                    results.push(result);
                    if (result.status === 'success') {
                        // uploadedFileCounter.count++; // uploadSingleFile 내부에서 처리하도록 이동 고려
                        completedFilesCount++; // 성공 시 전역 카운터 증가
                    }
                    return result;
                })
                .catch(errorResult => {
                    results.push(errorResult); // 실패 결과도 저장
                    failedCount++; // 실패 카운터 증가
                    failedFiles.push(errorResult.file || '알 수 없는 파일');
                    logError(`[Upload Manager] 파일 업로드 실패 처리: ${errorResult.file}`, errorResult.error);
                    // completedFilesCount는 증가시키지 않음
                    return errorResult; // Promise 체인을 위해 결과 반환
                })
                .finally(() => {
                    // Promise 완료 시 activeUploads에서 제거
                    const index = activeUploads.findIndex(p => p === uploadPromise); // 정확한 promise 비교
                    if (index > -1) {
                        activeUploads.splice(index, 1);
                    } else {
                         logWarn('[Upload Manager] 완료된 Promise를 activeUploads에서 찾지 못했습니다.');
                    }
                     // 다음 작업 시작 또는 완료 확인
                    checkCompletion(); // 완료 후 즉시 다음 작업 확인
                    runNextUpload(); // 재귀 호출 대신 checkCompletion 후에 호출
                });

            activeUploads.push(uploadPromise);
        }
         // 추가: activeUploads가 비어있고 queue도 비어있으면 완료 처리
         if (activeUploads.length === 0 && queue.length === 0) {
             checkCompletion();
         }
    }


    function checkCompletion() {
        logLog(`[Upload Check] 활성: ${activeUploads.length}, 대기열: ${queue.length}, 취소됨: ${isCancelled}, 중지됨: ${isPaused}`);
        // 중지 상태가 아니고, 활성 업로드와 대기열이 모두 비었을 때 완료 처리
        if (!isPaused && activeUploads.length === 0 && queue.length === 0) {
             logLog('[Upload Check] 모든 업로드 완료 또는 취소됨. finishCallback 호출.');
            if (finishCallback) {
                 finishCallback(); // Promise 해결
                 finishCallback = null; // 중복 호출 방지
            }
        }
    }


    // 초기 업로드 시작
    logLog(`[Upload Manager] 초기 업로드 시작 (동시 ${CONCURRENT_UPLOADS}개)`);
    runNextUpload(); // 최초 실행


    await allUploadsFinishedPromise; // 모든 작업이 완료될 때까지 대기 (중지 시에는 여기 도달 안 함)

    logLog(`[Upload Manager] allUploadsFinishedPromise 해결됨. isPaused: ${isPaused}, isCancelled: ${isCancelled}`);


    // --- 결과 처리 ---
    // successCount는 results 배열을 기반으로 다시 계산하는 것이 더 정확할 수 있음
    successCount = results.filter(r => r.status === 'success').length;
    // failedCount 와 failedFiles 는 catch 블록에서 이미 처리됨
    cancelledCount = results.filter(r => r.status === 'cancelled').length;


    if (isPaused) {
        logLog('[Upload Manager] 업로드 중지 상태. 모달 유지.');
        // 중지 상태에서는 추가 처리 없이 함수 종료 (모달은 열려 있음)
        return;
    } else if (isCancelled) {
         logLog('[Upload Manager] 업로드 취소됨.');
         // 취소 시 남은 큐 아이템도 취소 카운트에 포함 (이미 XHR abort됨)
         cancelledCount += queue.length; // queue는 비어있어야 하지만 안전하게 추가
         cancelledFiles = []; // 정리
         queue.length = 0; // 정리
         // completedFilesCount는 성공한 파일 수 유지
         initialTotalFiles = 0; // 초기화
         initialTotalBytesToUpload = 0; // 초기화
         totalBytesUploaded = 0; // 초기화
         hideUploadModal(); // 모달 닫기
    } else {
         // 정상 완료 또는 실패 포함 완료
         logLog('[Upload Manager] 업로드 완료됨.');
         cancelledFiles = []; // 정리
         hideUploadModal(); // 모달 닫기
    }


    // --- 최종 메시지 표시 ---
    if (typeof showToast === 'function') {
        let finalMessage = '';
        let messageType = 'info';


        // 시나리오별 메시지 구성
        if (isCancelled) {
            finalMessage = `업로드가 취소되었습니다. (${completedFilesCount}개 완료)`;
            messageType = 'warning';
        } else if (failedCount > 0) {
            finalMessage = `${successCount}개 성공, ${failedCount}개 실패.`;
            // cancelledCount는 0이어야 함 (취소되지 않았으므로)
            // finalMessage += ` 실패 목록: ${failedFiles.join(', ')}`.substring(0, 200);
            messageType = 'warning';
             // 실패 목록은 콘솔에서 확인 가능하도록 유도하거나, 별도 UI 필요
             logError(`[Upload Result] 실패 파일 목록: ${failedFiles.join(', ')}`);
        } else if (successCount === totalFiles && totalFiles > 0) {
            finalMessage = `${totalFiles}개 파일 업로드를 완료했습니다.`;
            messageType = 'success';
        } else if (totalFiles === 0 && !isResume) {
             // 업로드할 파일이 애초에 없었던 경우 (위에서 return했지만 방어 코드)
             finalMessage = '업로드할 파일이 없습니다.';
             messageType = 'info';
        } else if (successCount < totalFiles && successCount > 0) {
             // 일부만 성공하고 나머지는 알 수 없는 이유로 누락된 경우 (이론상 없어야 함)
             finalMessage = `일부 파일(${successCount}/${totalFiles})만 업로드되었습니다.`;
             messageType = 'warning';
        } else if (successCount === 0 && failedCount === 0 && cancelledCount === 0 && totalFiles > 0) {
             // 아무 일도 일어나지 않은 경우?
             finalMessage = '업로드 작업 상태를 알 수 없습니다.';
             messageType = 'error';
        }


        if (finalMessage) {
            logLog(`[Upload Result] 최종 메시지: "${finalMessage}" (type: ${messageType})`);
            showToast(finalMessage, messageType, failedCount > 0 ? 10000 : 5000);
        } else {
             logWarn('[Upload Result] 최종 메시지가 생성되지 않았습니다.');
        }
    }


    // --- 파일 목록 새로고침 ---
    // 성공 또는 실패한 파일이 하나라도 있으면 새로고침
    if (!isCancelled && !isPaused && (successCount > 0 || failedCount > 0)) {
        let refreshDelay = totalFiles <= 100 ? 300 : totalFiles <= 1000 ? 1000 : 2000;
        setTimeout(() => {
            logLog(`[Upload] 업로드 완료/실패 후 파일 목록 새로고침 시작 (파일 수: ${totalFiles}, 대기 시간: ${refreshDelay}ms)`);
            if (typeof loadFiles === 'function' && typeof currentPath !== 'undefined') {
                loadFiles(currentPath);
            } else {
                 logWarn('[Upload] loadFiles 함수 또는 currentPath를 찾을 수 없어 새로고침을 건너<0xEB><0x9B><0x81>니다.');
            }
        }, refreshDelay);
    } else {
        logLog(`[Upload] 파일 목록 새로고침 건너<0xEB><0x9B><0x81>니다 (취소됨: ${isCancelled}, 중지됨: ${isPaused}, 성공: ${successCount}, 실패: ${failedCount}).`);
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