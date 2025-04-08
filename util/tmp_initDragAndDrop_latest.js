function initDragAndDrop() {
    // 파일 리스트에 이벤트 위임 사용 - 동적으로 생성된 파일 항목에도 이벤트 처리
    const fileList = document.getElementById('fileList');
    const fileView = document.getElementById('fileView');
    const dropZone = document.getElementById('dropZone');
    
    if (!fileList || !fileView || !dropZone) {
        console.error('드래그앤드롭 초기화 중 필수 DOM 요소를 찾을 수 없습니다.');
        return;
    }
    
    console.log('초기화 시 드래그 클래스 정리');
    // 페이지 로드 시 이전에 남아있는 드래그 관련 클래스 모두 제거
    document.querySelectorAll('.dragging, .drag-over').forEach(element => {
        element.classList.remove('dragging', 'drag-over');
    });
    
    // 중복 초기화 방지 (이벤트 리스너가 중복 등록되는 것을 방지)
    fileList.removeEventListener('dragstart', handleFileDragStart);
    fileList.removeEventListener('dragend', handleFileDragEnd);
    fileList.removeEventListener('dragenter', handleFileDragEnter);
    fileList.removeEventListener('dragover', handleFileDragOver);
    fileList.removeEventListener('dragleave', handleFileDragLeave);
    fileList.removeEventListener('drop', handleFileDrop);
    
    // 이벤트 핸들러 함수 정의
    function handleFileDragStart(e) {
        // 상위 폴더는 드래그 불가능
        if (e.target.classList.contains('parent-dir') || e.target.closest('.file-item[data-parent-dir="true"]')) {
            e.preventDefault();
            return;
        }
        
        console.log('드래그 시작 - 대상:', e.target.className);
        
        // 파일 항목 요소 찾기
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        // 전역 드래그 상태 변수 설정 - 내부 드래그 플래그 설정
        window.draggingInProgress = true;
        window.draggingStartTime = Date.now();
        
        const fileName = fileItem.getAttribute('data-name');
        console.log('드래그 시작:', fileName);
        
        // 선택되지 않은 항목을 드래그하는 경우, 선택 초기화 후 해당 항목만 선택
        if (!fileItem.classList.contains('selected')) {
            clearSelection();
            selectItem(fileItem);
        }

        // 드래그 중인 항목 개수
        const dragCount = selectedItems.size;
        console.log(`드래그 시작: ${dragCount}개 항목 드래그 중`);
        
        try {
            // 1. JSON 형식으로 드래그 데이터 설정 (파일 경로 포함)
            const draggedItems = Array.from(selectedItems).map(name => {
                return currentPath ? `${currentPath}/${name}` : name;
            });
            
            const jsonData = {
                source: 'internal',
                host: window.location.host,
                timestamp: Date.now(),
                items: draggedItems
            };
            e.dataTransfer.setData('application/json', JSON.stringify(jsonData));
            
            // 2. 내부 드래그 마커 설정 (보안 강화)
            e.dataTransfer.setData('application/x-internal-drag', 'true');

            // 3. 일반 텍스트 데이터로도 저장 (호환성 유지)
            e.dataTransfer.setData('text/plain', draggedItems.join('\n'));
            
            // 4. 드래그 이미지 설정 수정 (Data URI 사용)
            const transparentImage = new Image();
            transparentImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

            // 투명 GIF 이미지를 드래그 이미지로 설정 (오프셋 0, 0)
            e.dataTransfer.setDragImage(transparentImage, 0, 0);

            // effectAllowed 설정 (모든 경우에 적용)
            e.dataTransfer.effectAllowed = 'move';

            console.log('[File Drag Start] 커스텀 투명 GIF 드래그 이미지 설정 완료');
            console.log('[File Drag Start] dataTransfer types set:', Array.from(e.dataTransfer.types));

            // 5. 드래그 중인 항목에 시각적 효과 적용 (setTimeout 제거)
            document.querySelectorAll('.file-item.selected').forEach(item => {
                item.classList.add('dragging'); // 동기적으로 클래스 추가
            });

        } catch (error) {
            console.error('드래그 시작 중 오류:', error);
            // 기본 정보만이라도 설정
            if (fileItem) {
                const fileName = fileItem.getAttribute('data-name');
                e.dataTransfer.setData('text/plain', fileName);
            }
        }
    }
    
    function handleFileDragEnd(e) {
        console.log('파일 리스트 dragend 이벤트 발생');
        
        // 2. 보편적인 드래그 상태 정리 함수 호출
        handleDragEnd(); // .dragging 클래스 제거 등 포함
        
        // 3. 드롭존 비활성화
        dropZone.classList.remove('active');
    }
    
// 모든 drag-over 클래스를 제거하는 함수
function clearAllDragOverClasses() {
    document.querySelectorAll('.file-item.drag-over').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleFileDragEnter(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) {
        // 파일 항목이 없으면 모든 강조 제거
        clearAllDragOverClasses();
        return;
    }
    
    // 상위 폴더인 경우 드래그 오버 스타일 적용하지 않음
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        clearAllDragOverClasses();
        return;
    }
    
    // 폴더인 경우에만 처리하고 시각적 표시
    if (fileItem.getAttribute('data-is-folder') === 'true') {
        // 선택된 폴더에 대한 드래그는 무시
        if (fileItem.classList.contains('selected')) {
            console.log('자기 자신이나 하위 폴더에 드래그 불가: ', fileItem.getAttribute('data-name'));
            clearAllDragOverClasses();
            return;
        }
        
        // 다른 폴더들의 강조 제거
        clearAllDragOverClasses();
        
        console.log('드래그 진입:', fileItem.getAttribute('data-name'));
        // 현재 폴더에만 드래그 오버 스타일 적용
        fileItem.classList.add('drag-over');
    } else {
        // 파일인 경우 모든 강조 제거
        clearAllDragOverClasses();
    }
}
    
function handleFileDragOver(e) {
    e.preventDefault(); // 드롭 허용
    e.stopPropagation(); // 이벤트 버블링 방지
    
    const fileItem = e.target.closest('.file-item');
    
    // 파일 항목이 없거나 드래그 타겟이 파일 리스트인 경우
    if (!fileItem || e.target === fileList || e.target === fileView) {
        clearAllDragOverClasses();
        return;
    }
    
    // 상위 폴더인 경우 드래그 오버 처리하지 않음
    if (fileItem.getAttribute('data-parent-dir') === 'true') {
        e.dataTransfer.dropEffect = 'none'; // 드롭 불가능 표시
        clearAllDragOverClasses();
        return;
    }
    
    // 폴더인 경우에만 처리
    if (fileItem.getAttribute('data-is-folder') === 'true') {
        // 선택된 폴더에 대한 드래그는 무시
        if (fileItem.classList.contains('selected')) {
            e.dataTransfer.dropEffect = 'none'; // 드롭 불가능 표시
            clearAllDragOverClasses();
            return;
        }
        
        // 드롭존 비활성화 - 폴더에 드래그할 때는 전체 드롭존이 아닌 폴더 자체에 표시
        if (dropZone) {
            dropZone.classList.remove('active');
        }
        
        // 다른 요소의 강조 모두 제거하고 현재 폴더만 강조
        clearAllDragOverClasses();
        fileItem.classList.add('drag-over');
        
        // 기본 드롭 효과 설정 (드롭 후 판단)
        const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
        e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
    } else {
        // 파일 항목인 경우 모든 강조 제거
        clearAllDragOverClasses();
        e.dataTransfer.dropEffect = 'none'; // 파일에는 드롭 불가
    }
}
    
function handleFileDragLeave(e) {
    // 이 함수는 필요 없음 - dragover 이벤트에서 모든 처리를 수행
    // 빈 함수로 남겨둠
}

// 이벤트 리스너 등록
fileList.addEventListener('dragenter', handleFileDragEnter);
fileList.addEventListener('dragover', handleFileDragOver);
fileList.addEventListener('dragleave', handleFileDragLeave);
fileList.addEventListener('drop', handleFileDrop);

// 전체 영역 드롭존 이벤트 함수들
function handleDropZoneDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    
        // 모든 드래그 이벤트에 대해 드롭존 활성화
        // 드롭 시점에 내부/외부 판단
        if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')) {
            dropZone.classList.add('active');
        }
    }
    
function handleDropZoneDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 모든 드래그 이벤트에 대해 드롭존 유지
        // 드롭 시점에 내부/외부 판단
        if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')) {
            // 기본 드롭 효과 설정 (드롭 후 판단)
            const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
            e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
            dropZone.classList.add('active');
        }
    }
    
function handleDropZoneDragLeave(e) {
        // relatedTarget이 null이거나 dropZone의 자식 요소가 아닌 경우에만 비활성화
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('active');
    }
}

function handleDropZoneDrop(e) {
    console.log('드롭존에 파일 드롭됨');
    preventDefaults(e);
    
    // 드래그 상태 초기화
    window.draggingInProgress = false;
    
    // 내부/외부 파일 판단
    const { isExternalDrop, isInternalDrop, draggedPaths, reason } = determineDropType(e);
    
    // 최종 판단: 외부 파일이 있으면 외부 드롭으로 처리
    if (isExternalDrop) {
        console.log('드롭존 드롭 - 외부 파일 드롭 처리');
        handleExternalFileDrop(e, currentPath);
    } 
    // 내부 파일이라도 경로가 비어있으면 오류 처리
    else if (isInternalDrop && draggedPaths.length > 0) {
        console.log('드롭존 드롭 - 내부 파일 이동 처리:', draggedPaths);
        // 현재 드롭존의 경로로 파일 이동
        handleInternalFileDrop(draggedPaths, { path: currentPath });
    }
    // 판단 불가능한 경우
    else {
        console.log('드롭존 드롭 - 처리할 수 없는 드롭 데이터');
        showToast('처리할 수 없는 드롭 데이터입니다.', 'error');
        }
    }
    
    // 전체 영역 드롭존 이벤트 리스너 등록
    window.removeEventListener('dragenter', handleDropZoneDragEnter);
    window.removeEventListener('dragover', handleDropZoneDragOver);
    window.removeEventListener('dragleave', handleDropZoneDragLeave);
    dropZone.removeEventListener('drop', handleDropZoneDrop);
    
    console.log('드롭존 이벤트 리스너 등록 완료 (handleDrop 이벤트는 initDropZone에서 등록)');
    
    // 개발 모드에서 폴더 항목 CSS 선택자 유효성 확인
    console.log('폴더 항목 개수:', document.querySelectorAll('.file-item[data-is-folder="true"]').length);
}
