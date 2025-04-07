# 대용량 파일 관리 및 코드 정리를 위한 유틸리티 스크립트

이 폴더에는 대용량 파일의 효율적인 관리와 코드 정리를 위한 다양한 파이썬 스크립트가 포함되어 있습니다.

## 1. 대용량 파일 부분 수정 유틸리티

대용량 파일의 특정 부분을 안전하게 수정하기 위한 스크립트입니다.

### `extract_for_edit.py`

파일을 복사하고 특정 라인 범위를 추출하여 수정용 파일을 만듭니다.

**사용법:**
```bash
python util/extract_for_edit.py <원본 파일 경로> <시작 줄> <끝 줄>
```

**인수:**
- `원본 파일 경로`: 수정할 원본 파일의 전체 경로
- `시작 줄`: 추출을 시작할 줄 번호 (1부터 시작)
- `끝 줄`: 추출을 끝낼 줄 번호 (1부터 시작, 해당 줄 포함)

**출력:**
- `util/<원본 파일명>.copy`: 원본 파일의 복사본
- `util/<원본 파일명>.part_to_edit`: 추출된 라인 범위가 저장된 파일 (이 파일을 수정)

**예시:**
```bash
python util/extract_for_edit.py backend/server.js 100 250
```

### `insert_edited_part.py`

복사본 파일의 특정 라인 범위를 사용자가 수정한 파일 내용으로 교체합니다.

**사용법:**
```bash
python util/insert_edited_part.py <복사본 파일> <시작 줄> <끝 줄> <수정된 파일> [-o <출력 파일>]
```

**인수:**
- `복사본 파일`: 수정 대상 복사본 파일 경로 (예: `util/server.js.copy`)
- `시작 줄`: 교체를 시작할 줄 번호 (1부터 시작)
- `끝 줄`: 교체를 끝낼 줄 번호 (1부터 시작)
- `수정된 파일`: 사용자가 수정한 코드가 담긴 파일 경로 (예: `util/server.js.part_to_edit`)
- `-o 출력 파일` (선택): 결과를 저장할 파일 경로. 지정하지 않으면 복사본 파일을 덮어씁니다.

**예시:**
```bash
python util/insert_edited_part.py util/server.js.copy 100 250 util/server.js.part_to_edit
```

## 2. 코드 중복 및 정리 유틸리티

코드 중복을 감지하고 정리하기 위한 스크립트입니다.

### `find_duplicate_functions.py`

JavaScript 파일에서 중복된 함수를 찾고, 중복 제거를 위한 스크립트를 생성합니다.

**사용법:**
```bash
python util/find_duplicate_functions.py <JavaScript 파일 경로>
```

**인수:**
- `JavaScript 파일 경로`: 중복 함수를 검사할 JavaScript 파일 경로

**기능:**
- 파일 내 모든 함수 선언을 찾아 정확한 위치(시작/끝 줄) 파악
- 중복된 함수 목록과 각 함수의 모든 선언 위치를 표시
- 중복 함수 제거를 위한 파이썬 스크립트 자동 생성 (마지막 선언을 제외한 모든 중복 선언 삭제)

**예시:**
```bash
python util/find_duplicate_functions.py frontend/script.js
```

### `delete_lines.py` 

파일에서 지정된 라인 범위를 삭제하는 간단한 유틸리티입니다.

**사용법:**
```bash
python util/delete_lines.py <파일 경로> <시작 줄> <끝 줄>
```

**인수:**
- `파일 경로`: 라인을 삭제할 파일의 경로
- `시작 줄`: 삭제 시작 라인 번호 (1부터 시작)
- `끝 줄`: 삭제 끝 라인 번호 (포함)

**예시:**
```bash
python util/delete_lines.py frontend/script.js 100 150
```

## 작업 흐름 예시

### 대용량 파일 부분 수정 흐름

1. **추출 단계:** 대형 파일에서 수정할 부분 추출
   ```bash
   python util/extract_for_edit.py backend/server.js 1000 1500
   ```

2. **수정 단계:** `util/server.js.part_to_edit` 파일을 텍스트 편집기로 수정

3. **삽입 단계:** 수정된 내용을 복사본 파일에 다시 합치기
   ```bash
   python util/insert_edited_part.py util/server.js.copy 1000 1500 util/server.js.part_to_edit
   ```

4. **반영 단계:** 수정된 복사본을 원래 위치로 복사
   ```bash
   cp util/server.js.copy backend/server.js
   ```

### 중복 함수 제거 흐름

1. **중복 감지:** JavaScript 파일에서 중복 함수 찾기
   ```bash
   python util/find_duplicate_functions.py frontend/script.js
   ```

2. **자동 생성된 스크립트 실행:** 중복 함수 삭제
   ```bash
   python util/remove_duplicates_script_js.py frontend/script.js
   ```

## 주의사항

- 모든 스크립트는 줄 번호를 1부터 시작합니다.
- 파일 작업 전 백업을 권장합니다.
- 스크립트는 파일 인코딩을 UTF-8로 가정합니다.
- 시스템 파일 수정 시 적절한 권한(sudo)이 필요할 수 있습니다. 