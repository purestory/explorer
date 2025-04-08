

## 1. 코드 중복 및 정리 유틸리티

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
python3 util/find_duplicate_functions.py frontend/script.js
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



## 유틸리티 스크립트

프로젝트 개발 및 유지보수를 돕는 유틸리티 스크립트입니다. `util` 디렉토리에 위치합니다.

### `find_function.py`

JavaScript 파일 내에서 특정 함수의 코드 블록을 찾아 별도의 파일로 추출하고, 원본 파일에서의 시작 및 끝 라인 번호를 출력합니다.

**사용법:**

```bash
python3 util/find_function.py <JavaScript 파일 경로> <함수 이름> <추출할 파일 경로>
```

**예시:**

```bash
python3 util/find_function.py frontend/script.js initShortcuts util/extracted_initShortcuts.js
```

### `replace_code_block.py`

대상 파일의 지정된 라인 범위를 다른 파일의 내용으로 교체합니다. 실행 시 원본 파일을 자동으로 백업합니다 (`.bak` 확장자).

**사용법:**

```bash
python3 util/replace_code_block.py <대상 파일 경로> <교체할 코드가 담긴 파일 경로> <시작 라인> <끝 라인>
```

**주의:** 이 스크립트는 대상 파일을 직접 수정합니다. 실행 전 파일 경로와 라인 번호를 다시 한번 확인하세요.

**예시:**

```bash
# frontend/script.js 파일의 835-880 라인을 util/modified_initShortcuts.js 파일 내용으로 교체
python3 util/replace_code_block.py frontend/script.js util/modified_initShortcuts.js 835 880
```



## 주의사항

- 모든 스크립트는 줄 번호를 1부터 시작합니다.
- 파일 작업 전 백업을 권장합니다.
- 스크립트는 파일 인코딩을 UTF-8로 가정합니다.
- 시스템 파일 수정 시 적절한 권한(sudo)이 필요할 수 있습니다. 