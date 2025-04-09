# frontend/script.js 모듈 분리 작업 계획

## 1. 목표

-   `frontend/script.js` 파일을 기능별 모듈로 분리하여 코드의 가독성, 유지보수성, 재사용성을 향상시킨다.
-   ES6 모듈 시스템 (`import`/`export`)을 도입한다.

## 2. 분리 방식

-   기능 기반 분리 (Feature-based) 방식을 채택한다.

## 3. 제안 모듈 구조 및 내용 (실제 코드 분석 기반)

**주의:** 아래 목록은 `script.js` 분석을 통해 식별된 주요 함수/변수 기준이며, 리팩토링 과정에서 추가 발견 및 조정이 필요할 수 있습니다. 전역 변수 및 DOM 요소 참조는 각 모듈에서 필요에 따라 `import` 하거나 `state` 또는 `ui` 모듈을 통해 접근하도록 변경합니다.

---

### `config.js`

-   **역할:** 애플리케이션 설정 값 관리.
-   **내용:**
    -   `API_BASE_URL` (상수)
-   **의존성:** 없음

---

### `state.js`

-   **역할:** 공유되는 애플리케이션 상태 관리.
-   **내용:**
    -   `currentPath` (상태 변수)
    -   `selectedItems` (Set, 상태 변수)
    -   `clipboardItems` (Array, 상태 변수)
    -   `clipboardOperation` (String: 'cut'/'copy'/'', 상태 변수)
    -   `listView` (boolean, 상태 변수)
    -   `diskUsage` (Object, 상태 변수)
    -   `sortField`, `sortDirection` (String, 상태 변수)
    -   `fileInfoMap` (Map, 상태 변수)
    -   `lockedFolders` (Array, 상태 변수)
    -   `lockFeatureAvailable` (boolean, 상태 변수)
    -   `isLoading` (boolean, 상태 변수 - `showLoading`/`hideLoading`과 연계)
    -   `window.dragSelectState` (객체, 상태 변수) -> 내부 상태로 변경
    -   `syncCurrentPath(path)` (상태 변경 및 window 객체 업데이트) -> `setCurrentPath` 등으로 변경
    -   *Getter/Setter 함수들 (예: `getCurrentPath`, `setCurrentPath`, `getSelectedItems`, `addSelectedItem`, `clearSelectedItems`, `getClipboard`, `setClipboard`, `getLockedFolders`, `setLockedFolders` 등)*
-   **의존성:** 없음

---

### `api.js`

-   **역할:** 백엔드 API 호출 로직 캡슐화.
-   **내용:**
    -   `loadFilesRequest(path)` (`GET /api/files/{path}`) *
    -   `renameItemRequest(oldPath, newName, targetPath)` (`PUT /api/files/{oldPath}`) *
    -   `deleteItemsRequest(itemsPaths)` (`DELETE /api/files/{path}` 반복 호출) *
    -   `moveItemRequest(sourcePath, targetPath, overwrite)` (`PUT /api/files/{sourcePath}` - 이름 변경 API 재활용) * -> `moveItemsRequest`와 통합 고려
    -   `compressRequest(items, zipName)` (`POST /api/compress`) *
    -   `deleteCompressedFileRequest(zipPath)` (`DELETE /api/files/{zipPath}`) *
    -   `createFolderRequest(path, folderName)` (`POST /api/folders`) *
    -   `getLockStatusRequest()` (`GET /api/lock-status`) *
    -   `toggleLockRequest(folders, action)` (`POST /api/lock`) *
    -   `getDiskUsageRequest()` (`GET /api/disk-usage`) *
    -   *내부 `fetchWrapper` 함수*
-   **의존성:** `config.js`, `state.js`

---

### `ui.js`

-   **역할:** DOM 업데이트, UI 렌더링, 사용자 피드백.
-   **내용:**
    -   `updateFileList(files)` (`renderFiles` 또는 `displayFiles` 기반)
    -   `createFileItemElement(fileInfo)` (`renderFiles` 또는 `displayFiles` 내부 로직 분리)
    -   `updateToolbarState()` (`updateButtonStates` 기반)
    -   `showLoading()`
    -   `hideLoading()`
    -   `updateStatusInfo(message, type)` (`statusInfo.textContent` 업데이트)
    -   `updateSelectionInfo(count)` (`selectionInfo.textContent` 업데이트)
    -   `highlightItem(element)`, `unhighlightItem(element)`
    -   `clearSelectionUI()` (`clearSelection`의 UI 부분)
    -   `renderPathNavigation(path)` (`updateBreadcrumb` 또는 유사 함수)
    -   `showToast(message, type)`
    -   `renderListViewHeader()` (`renderFiles` 내부 로직 분리)
    -   `toggleViewMode(isListView)` (클래스 변경 로직)
    -   `updateFileCount(count)`
    -   `addHoverEffect(element)`, `removeHoverEffect(element)` (`mousemove` 리스너 내부 로직 분리)
    -   `showSelectionBox(x, y, w, h)`, `hideSelectionBox()` (`initDragSelect` 내부 로직 분리)
    -   `updateSortIndicators()` (헤더 정렬 아이콘 업데이트)
    -   `clearAllDragOverClasses()`
    -   DOM 요소 참조 변수들 (필요한 것만)
-   **의존성:** `state.js`, `utils.js`

---

### `fileOperations.js`

-   **역할:** 파일/폴더 관련 사용자 액션 처리 (상태 변경, UI 조작, API 호출 조정).
-   **내용:**
    -   `loadFiles(path)` (`api.js` 호출 및 `ui.js` 호출)
    -   `handleItemOpen(itemElement)` (더블클릭 또는 Enter 시 폴더 이동/파일 열기)
    -   `handleItemSelection(itemElement, event)` (`toggleSelection`, `handleShiftSelect` 등)
    -   `deleteSelectedItems()` (`modals.js` 확인 호출, `api.js` 호출, `ui.js` 호출)
    -   `pasteItems()` (`state.js` 확인, `api.js` 호출, `ui.js` 호출)
    -   `createNewFolder()` (`modals.js` 입력 호출, `api.js` 호출)
    -   `downloadSelectedItems()` (`api.js` 호출)
    -   `compressAndDownload(itemList)` (`api.js` 호출)
    -   `navigateToParentFolder()` (`state.js` 변경, `updateHistoryState`, `loadFiles`)
    -   `openFile(filePath)` (`window.open` 등)
    -   `toggleFolderLock(action)` (`api.js` 호출, `state.js` 업데이트, `ui.js` 호출)
    -   `loadDiskUsage()` (`api.js` 호출, `state.js` 업데이트)
    -   `clearSelection()` (상태 및 UI 클리어)
-   **의존성:** `state.js`, `api.js`, `ui.js`, `modals.js`, `utils.js`, `history.js`

---

### `modals.js`

-   **역할:** 모달 창 관리 (표시, 숨김, 내부 로직).
-   **내용:**
    -   `initModals()` (모달 공통 이벤트 리스너 등록)
    -   `showRenameDialog()`
    -   `handleRenameConfirm()` (`api.js` 호출) -> `fileOperations.js` 또는 `rename.js` 고려
    -   `hideRenameDialog()`
    -   `showFolderModal()` (`createFolderBtn` 리스너)
    -   `handleFolderCreateConfirm()` (`api.js` 호출) -> `fileOperations.js` 고려
    -   `hideFolderModal()`
    -   `showConfirmDialog(message, confirmCallback)` (공용 확인 모달)
    -   DOM 요소 참조 (`renameModal`, `folderModal` 등)
-   **의존성:** `state.js`, `api.js`, `ui.js`, `fileOperations.js`

---

### `contextMenu.js`

-   **역할:** 컨텍스트 메뉴 생성, 표시, 이벤트 처리.
-   **내용:**
    -   `initContextMenu()`
    -   `showContextMenu(event)`
    -   `hideContextMenu()`
    -   `handleContextMenuAction(action)` (클릭된 메뉴 항목에 따라 각 기능 모듈 호출)
    -   DOM 요소 참조 (`contextMenu` 및 하위 항목)
-   **의존성:** `state.js`, `ui.js`, `fileOperations.js`, `clipboard.js`, `modals.js`

---

### `clipboard.js`

-   **역할:** 잘라내기/복사 관련 상태 및 액션 처리.
-   **내용:**
    -   `cutSelectedItems()` (`state.js` 업데이트, `ui.js` 호출)
    -   `copySelectedItems()` (`state.js` 업데이트, `ui.js` 호출 - 현재 미구현 추정)
    -   `initClipboardOperations()` (`cutBtn`, `pasteBtn` 리스너 등록) -> `eventListeners.js`
-   **의존성:** `state.js`, `ui.js`

---

### `search.js`

-   **역할:** 검색 기능 로직.
-   **내용:**
    -   `initSearch()` (리스너 등록) -> `eventListeners.js`
    -   `handleSearchInput(query)` (필터링 로직)
    -   `filterFileList(query)` (`ui.js` 업데이트) -> `ui.js` 내부로 이동 가능
-   **의존성:** `ui.js`

---

### `dragDrop.js`

-   **역할:** 드래그 앤 드롭 기능 로직 (파일 이동 및 업로드).
-   **내용:**
    -   `initDragSelect()` (드래그 선택 초기화)
    -   `setupGlobalDragCleanup()` (전역 드래그 상태 정리)
    -   `initDropZone()` (드롭존 이벤트 리스너 등록)
    -   `handleDragStart(e, fileItem)`
    -   `handleFileDragEnter(e)`, `handleFileDragOver(e)`, `handleFileDragLeave(e)` (파일 항목 위)
    -   `handleFileDrop(e)` (파일 항목 위)
    -   `handleDropZoneDragEnter(e)`, `handleDropZoneDragOver(e)`, `handleDropZoneDragLeave(e)` (전체 영역)
    -   `handleDropZoneDrop(e)` (전체 영역)
    -   `determineDropType(e)`
    -   `handleInternalFileDrop(draggedItemPaths, targetFolderItem)` (`fileOperations.js`의 `moveToFolder` 호출)
    -   `handleExternalFileDrop(event, targetPath)` (`upload.js` 호출)
    -   `autoScroll(clientX, clientY)`, `cancelAutoScroll()` (`initDragSelect` 내부 함수)
-   **의존성:** `state.js`, `ui.js`, `fileOperations.js`, `upload.js`

---

### `utils.js`

-   **역할:** 재사용 가능한 범용 유틸리티 함수.
-   **내용:**
    -   `formatFileSize(bytes)`
    -   `formatDate(dateString)`
    -   `getFileIconClass(filename)`
    -   `getSortIcon(field)`
    -   `debounce(func, wait)`
    -   `preventDefaults(e)`
    -   `getParentPath(path)`
    -   *기타 DOM, 경로, 문자열 관련 헬퍼 함수*
-   **의존성:** 없음

---

### `history.js`

-   **역할:** 브라우저 히스토리 관리 (뒤로가기/앞으로가기).
-   **내용:**
    -   `initHistory()` (`popstate` 리스너 등록) -> `main.js` 또는 `eventListeners.js`
    -   `updateHistoryState(path)` (`history.pushState` 호출)
    -   `handlePopState(event)` (`loadFiles` 호출)
-   **의존성:** `state.js`, `fileOperations.js`

---

### `eventListeners.js`

-   **역할:** 주요 DOM 요소에 대한 이벤트 리스너 등록 로직 분리.
-   **내용:**
    -   `initCoreListeners()` (window `keydown`, `click`, `popstate` 등)
    -   `initToolbarListeners()` (`createFolderBtn`, `gridViewBtn`, `listViewBtn`, `downloadBtn`, `cutBtn`, `pasteBtn`, `deleteBtn` 등)
    -   `initFileListListeners()` (`fileView`에 `click`, `dblclick`, `contextmenu`, `dragstart` 등 위임)
    -   `initModalListeners()` (`folderModal`, `renameModal` 내부 버튼 등)
    -   `initSearchListener()` (`searchInput`)
    -   `initDropZoneListeners()` (`initDropZone` 호출)
    -   `initDragSelectListeners()` (`initDragSelect` 호출)
-   **의존성:** 각 기능 모듈 (`fileOperations.js`, `modals.js`, `clipboard.js`, `contextMenu.js` 등)의 핸들러 함수, `dragDrop.js`

---

### `main.js`

-   **역할:** 애플리케이션 시작점, 모듈 초기화 및 연결.
-   **내용:**
    -   `initApp()`
        -   `config` 로드 (간단하므로 직접 포함 가능)
        -   `state` 초기화
        -   `eventListeners.js`의 초기화 함수들 호출
        -   `loadLockStatus`, `loadDiskUsage` 호출
        -   초기 경로 결정 및 `loadFiles` 호출
    -   `DOMContentLoaded` 이벤트 리스너에서 `initApp()` 호출
-   **의존성:** 모든 모듈 (`state.js`, `api.js`, `ui.js`, `eventListeners.js`, `fileOperations.js` 등)

---

## 4. 리팩토링 단계

1.  **준비:** `frontend` 디렉토리에 `.js` 파일들을 생성합니다.
2.  **점진적 분리:** `config.js`, `utils.js`, `state.js`, `api.js`, `ui.js` 순서로 분리 및 테스트.
3.  **기능 모듈 분리:** 나머지 모듈 (`modals`, `contextMenu`, `clipboard`, `search`, `dragDrop`, `fileOperations`, `history`, `eventListeners`) 분리 및 테스트.
4.  **`main.js` 구성:** 초기화 로직 이동.
5.  **마무리:** `script.js` 삭제 및 HTML 수정.

## 5. 추가 고려 사항

-   전역 변수 제거
-   오류 처리 개선
-   비동기 처리 일관성
-   단계별 테스트

--- 