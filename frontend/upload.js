document.addEventListener('DOMContentLoaded', () => {
    // frontend/upload.js

    // --- 업로드 모달 관련 요소 초기화 ---
    const uploadProgressModal = document.getElementById('upload-progress-modal');
    const overallProgressBar = document.getElementById('overall-progress-bar');
    const overallProgressText = document.getElementById('overall-progress-text');
    const currentFileInfo = document.getElementById('current-file-info');
    const cancelUploadBtn = document.getElementById('cancel-upload-btn');

    // --- 요소 존재 확인 (초기화 시) ---
    if (!uploadProgressModal || !overallProgressBar || !overallProgressText || !currentFileInfo || !cancelUploadBtn) {
        console.error('[Upload Init] Failed to find one or more upload modal elements. Upload UI might not work.');
    } else {
        // 초기 상태: 취소 버튼 비활성화
        cancelUploadBtn.disabled = true;
    }

    // --- 업로드 상태 관리 ---
    let currentUploadXHR = null; // 현재 진행중인 XHR 객체 (취소용)
    let isCancelled = false; // 업로드 취소 플래그

    // --- 모달 제어 함수 ---
    function showUploadModal() {
        // 요소 초기화 확인 (함수 호출 시점에도 확인)
        if (!uploadProgressModal || !overallProgressBar || !overallProgressText || !currentFileInfo || !cancelUploadBtn) {
            console.error('[Upload] Modal elements not initialized correctly. Cannot show modal.');
            if (typeof showToast === 'function') showToast('업로드 UI를 표시할 수 없습니다.', 'error');
            return; 
        }
        isCancelled = false; 
        uploadProgressModal.style.display = 'flex'; 
        overallProgressBar.style.width = '0%';
        overallProgressText.textContent = '업로드 준비 중...';
        currentFileInfo.textContent = '';
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

    function updateUploadProgress(overallPercent, currentFileIndex, totalFiles, currentFileName, currentFilePercent) {
        if (!overallProgressBar || !overallProgressText || !currentFileInfo) {
            // console.error('[Upload] Modal progress elements not initialized correctly.'); // 너무 자주 로깅될 수 있으므로 주석 처리
            return;
        }
        overallProgressBar.style.width = `${overallPercent}%`;
        overallProgressText.textContent = `전체 진행률: ${overallPercent}% (${currentFileIndex}/${totalFiles} 파일)`;
        currentFileInfo.textContent = `현재 파일: ${currentFileName} (${currentFilePercent}%)`;
    }

    // --- 개별 파일 업로드 함수 (XMLHttpRequest 사용) ---
    async function uploadSingleFile(file, targetPath, relativePath, fileIndex, totalFiles) {
        return new Promise((resolve, reject) => {
            if (isCancelled) {
                console.log(`[Upload] 시작 시 취소됨: ${relativePath}`);
                return resolve({ cancelled: true });
            }

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
                    updateUploadProgress(overallPercent, fileIndex, totalFiles, file.name, currentFilePercent);
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
                    updateUploadProgress(overallPercent, fileIndex, totalFiles, file.name, 100);
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
    // 따라서 DOMContentLoaded 리스너 밖으로 빼거나, window 객체에 할당 필요.
    // 여기서는 편의상 함수 정의를 리스너 내부에 두고, window 객체에 할당.
    window.handleExternalFileDrop = async (e, targetFolderItem = null) => {
        try {
            const items = e.dataTransfer.items;
            if (!items || items.length === 0) {
                console.log('[Upload] 드롭된 항목이 없습니다.');
                return;
            }

            let targetPath = currentPath; // script.js의 currentPath 사용
            let targetName = '현재 폴더';

            // isPathLocked 함수 존재 여부 확인 (script.js에 있다고 가정)
            const isPathLockedDefined = typeof isPathLocked === 'function';

            if (targetFolderItem && typeof targetFolderItem.getAttribute === 'function' && targetFolderItem.hasAttribute('data-name')) {
                const folderName = targetFolderItem.getAttribute('data-name');
                const potentialTargetPath = currentPath ? `${currentPath}/${folderName}` : folderName;
                if (isPathLockedDefined && isPathLocked(potentialTargetPath)) {
                    console.warn(`[Upload] 잠긴 폴더 '${folderName}'(으)로는 업로드할 수 없습니다.`);
                    if (typeof showToast === 'function') showToast(`잠긴 폴더 '${folderName}'(으)로는 업로드할 수 없습니다.`, 'warning');
                    return; 
                } else if (!isPathLockedDefined) {
                    console.warn('[Upload] isPathLocked 함수 없음. 잠금 확인 없이 진행.');
                }
                targetPath = potentialTargetPath;
                targetName = folderName;
                console.log('[Upload] 외부 파일 드래그 감지: 대상 폴더:', targetName);
            } else {
                if (isPathLockedDefined && isPathLocked(currentPath)) {
                    console.warn(`[Upload] 현재 폴더 '${currentPath || '루트'}'가 잠겨 있어 업로드할 수 없습니다.`);
                    if (typeof showToast === 'function') showToast('현재 폴더가 잠겨 있어 업로드할 수 없습니다.', 'warning');
                    return; 
                } else if (!isPathLockedDefined){
                    console.warn('[Upload] isPathLocked 함수 없음. 현재 폴더 잠금 확인 없이 진행.');
                }
                console.log('[Upload] 외부 파일 드래그 감지: 현재 경로(', targetPath || '루트' ,')에 업로드');
            }

            // showLoading 함수가 script.js에 있다고 가정
            if (typeof showLoading === 'function') showLoading(); 

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
                    if (typeof showToast === 'function') showToast('폴더 구조를 읽는 중 오류가 발생했습니다.', 'error');
                    if (typeof hideLoading === 'function') hideLoading();
                    return; 
                }
            }

            if (typeof hideLoading === 'function') hideLoading(); 

            if (filesWithPaths.length === 0) {
                console.log('[Upload] 업로드할 파일을 찾을 수 없습니다.');
                if (typeof showToast === 'function') showToast('업로드할 파일을 찾을 수 없습니다.', 'warning');
                return;
            }

            console.log(`[Upload] 총 ${filesWithPaths.length}개의 파일 수집 완료. 순차 업로드 시작.`);
            await uploadFilesSequentially(filesWithPaths, targetPath);

        } catch (error) {
            console.error('[Upload] 외부 파일 드롭 처리 중 예상치 못한 오류:', error);
            if (typeof showToast === 'function') showToast(`파일 드롭 처리 중 오류 발생: ${error.message}`, 'error');
            if (typeof hideLoading === 'function') hideLoading(); 
        } 
    };

    // --- 업로드 취소 함수 --- 
    function cancelUpload() {
        if (currentUploadXHR) {
            console.log('[Upload] 업로드 취소 요청 (XHR 존재)');
            isCancelled = true; 
            currentUploadXHR.abort(); 
        } else {
            console.log('[Upload] 업로드 취소 요청 (XHR 없음, 플래그 설정)');
            isCancelled = true; 
            hideUploadModal(); 
            if (typeof showToast === 'function') showToast('업로드가 취소되었습니다.', 'warning');
        }
    }

    // --- 초기화 함수 (initializeUploader) ---
    // 이 함수는 전역 스코프에 노출되어야 script.js에서 호출 가능
    window.initializeUploader = () => {
        // DOM 요소는 이미 상단에서 초기화됨
        if (!uploadProgressModal) {
             console.warn('[Upload Init] 모달 요소가 아직 준비되지 않았습니다. 초기화를 지연합니다.');
             // 필요한 경우 setTimeout 등으로 재시도 로직 추가 가능
             // setTimeout(window.initializeUploader, 100); // 예: 100ms 후 재시도
             return;
        }

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
        }

        console.log('[Upload Init] Uploader initialized and listeners attached.');
    }; 

}); // End of DOMContentLoaded listener 