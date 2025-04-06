# 대용량 파일 부분 수정을 위한 유틸리티 스크립트

이 폴더에는 대용량 파일의 특정 부분을 안전하게 수정하기 위한 두 개의 파이썬 스크립트가 포함되어 있습니다.

- `extract_for_edit.py`: 원본 파일을 복사하고 수정할 부분을 별도의 파일로 추출합니다.
- `insert_edited_part.py`: 사용자가 수정한 부분을 다시 복사본 파일에 삽입합니다.

## 작업 흐름

1.  **추출 단계:** `extract_for_edit.py`를 사용하여 원본 파일을 복사하고 수정할 라인 범위를 별도 파일로 만듭니다. 수정할 라인 범위는 해당 함수 전체로 한다.
    ```bash
    python util/extract_for_edit.py <원본 파일 경로> <시작 줄> <끝 줄>
    ```
    *   `util` 폴더에 `<원본 파일명>.copy` (복사본) 파일이 생성됩니다.
    *   `util` 폴더에 `<원본 파일명>.part_to_edit` (수정할 부분) 파일이 생성됩니다.

2.  **수정 단계:** `util/<원본 파일명>.part_to_edit` 파일을 텍스트 편집기로 열어 원하는 대로 수정합니다. 수정 후에는 반드시 제대로 수정했는지 확인 후 보고한다.

3.  **삽입 단계:** `insert_edited_part.py`를 사용하여 수정된 내용을 복사본 파일에 다시 합칩니다.
    ```bash
    python util/insert_edited_part.py util/<원본 파일명>.copy <시작 줄> <끝 줄> util/<원본 파일명>.part_to_edit [-o <출력 파일 경로>]
    ```
    *   기본적으로 `util/<원본 파일명>.copy` 파일이 수정된 내용으로 업데이트됩니다.
    *   `-o` 옵션을 사용하면 결과를 지정된 `<출력 파일 경로>`에 저장할 수 있습니다.

4.  **반영 단계 (수동):** 수정이 완료된 `util/<원본 파일명>.copy` 파일을 **직접** 원래의 `<원본 파일 경로>`로 복사하여 변경 사항을 최종 반영합니다. 시스템 파일 등 권한이 필요한 경우 `sudo`를 사용하여 복사합니다.
    ```bash
    # 예시
    sudo cp util/my_config.conf.copy /etc/my_config.conf
    ```

5.  **정리 단계 (선택):** `util` 폴더에 생성된 임시 파일들 (`*.copy`, `*.part_to_edit`)을 삭제합니다.
    ```bash
    rm util/*.copy util/*.part_to_edit
    ```

## 스크립트 상세 설명

### `extract_for_edit.py`

파일을 복사하고 특정 라인 범위를 추출하여 수정용 파일을 만듭니다.

**사용법:**
```bash
python util/extract_for_edit.py source_file start_line end_line
```

**인수:**
- `source_file`: 수정할 원본 파일의 전체 경로.
- `start_line`: 추출을 시작할 줄 번호 (1부터 시작).
- `end_line`: 추출을 끝낼 줄 번호 (1부터 시작, 해당 줄 포함).

**출력:**
- `util/<원본 파일명>.copy`: 원본 파일의 복사본.
- `util/<원본 파일명>.part_to_edit`: 추출된 라인 범위가 저장된 파일. 이 파일을 수정합니다.

**예시:** `/var/log/long_log_file.log` 파일의 1000번째 줄부터 1500번째 줄까지 추출하기
```bash
python util/extract_for_edit.py /var/log/long_log_file.log 1000 1500
```

### `insert_edited_part.py`

복사본 파일의 특정 라인 범위를 사용자가 수정한 파일 내용으로 교체합니다.

**사용법:**
```bash
python util/insert_edited_part.py copy_file start_line end_line edited_part_file [-o output_file]
```

**인수:**
- `copy_file`: 수정 대상 복사본 파일 경로 (`util` 폴더 내, 예: `util/long_log_file.log.copy`).
- `start_line`: 교체를 시작할 줄 번호 (1부터 시작).
- `end_line`: 교체를 끝낼 줄 번호 (1부터 시작).
- `edited_part_file`: 사용자가 수정한 코드가 담긴 파일 경로 (예: `util/long_log_file.log.part_to_edit`).
- `-o output_file` (선택): 결과를 저장할 파일 경로. 지정하지 않으면 `copy_file`을 덮어씁니다.

**출력:**
- 지정된 `copy_file`이 업데이트되거나, `-o` 옵션으로 지정된 `output_file`이 생성됩니다.

**예시 1:** `util/long_log_file.log.copy` 파일의 1000-1500 줄을 `util/long_log_file.log.part_to_edit` 내용으로 교체하기
```bash
python util/insert_edited_part.py util/long_log_file.log.copy 1000 1500 util/long_log_file.log.part_to_edit
```

**예시 2:** 위와 동일하지만, 결과를 `modified_log_file.log` 라는 새 파일로 저장하기
```bash
python util/insert_edited_part.py util/long_log_file.log.copy 1000 1500 util/long_log_file.log.part_to_edit -o modified_log_file.log
```

## 주의사항

- 줄 번호는 1부터 시작합니다.
- 시작 줄 번호는 끝 줄 번호보다 크거나 같아야 합니다.
- 스크립트는 파일 인코딩을 UTF-8로 가정합니다. 다른 인코딩의 경우 스크립트 수정이 필요할 수 있습니다.
- 최종 결과 반영(`cp` 또는 `sudo cp`) 및 임시 파일 정리는 사용자가 직접 수행해야 합니다. 