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
                
                // 업로드된 경로로 파일 목록 새로고침 - 파일 개수에 따라 타임아웃 적용
                let refreshTimeout = 500; // 기본 500ms
                
                if (totalFiles > 1000) {
                    refreshTimeout = 2000; // 1000개 이상: 2000ms
                } else if (totalFiles > 50) {
                    refreshTimeout = 1000; // 50개 초과, 1000개 이하: 1000ms
                }
                
                console.log(`업로드 완료: ${totalFiles}개 파일, ${refreshTimeout}ms 후 새로고침`);
                
                // 설정된 타임아웃 후 새로고침 실행
                setTimeout(() => {
                    loadFiles(targetUploadPath);
                }, refreshTimeout);
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
