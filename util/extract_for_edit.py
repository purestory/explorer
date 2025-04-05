import argparse
import os
import shutil

UTIL_DIR = "util"

def extract_for_edit(source_file, start_line, end_line):
    """
    원본 파일을 util 폴더에 복사하고, 지정된 라인 범위를 추출하여 별도 파일로 저장합니다.

    Args:
        source_file (str): 원본 파일 경로.
        start_line (int): 추출 시작 줄 번호 (1부터 시작).
        end_line (int): 추출 끝 줄 번호 (1부터 시작).
    """
    # --- 입력값 유효성 검사 ---
    if not os.path.exists(source_file):
        print(f"오류: 원본 파일 '{source_file}'을(를) 찾을 수 없습니다.")
        return
    if not os.path.isdir(UTIL_DIR):
        print(f"정보: '{UTIL_DIR}' 폴더가 없어 생성합니다.")
        os.makedirs(UTIL_DIR)
    if not isinstance(start_line, int) or not isinstance(end_line, int) or start_line <= 0 or end_line <= 0:
        print("오류: 시작 줄과 끝 줄 번호는 0보다 큰 정수여야 합니다.")
        return
    if start_line > end_line:
        print("오류: 시작 줄 번호는 끝 줄 번호보다 클 수 없습니다.")
        return

    base_filename = os.path.basename(source_file)
    copy_filepath = os.path.join(UTIL_DIR, f"{base_filename}.copy")
    part_filepath = os.path.join(UTIL_DIR, f"{base_filename}.part_to_edit")

    try:
        # --- 원본 파일 복사 ---
        shutil.copy2(source_file, copy_filepath)
        print(f"성공: 원본 파일 '{source_file}'을(를) '{copy_filepath}'(으)로 복사했습니다.")

        # --- 원본 파일 읽기 ---
        with open(source_file, 'r', encoding='utf-8') as f:
            source_lines = f.readlines()

        # 지정된 줄 번호가 파일 범위를 벗어나는지 확인
        if start_line > len(source_lines) or end_line > len(source_lines):
             print(f"오류: 지정된 줄 번호 ({start_line}-{end_line})가 파일 총 줄 수({len(source_lines)})를 벗어납니다.")
             # 생성된 복사본 파일 삭제
             if os.path.exists(copy_filepath):
                 os.remove(copy_filepath)
                 print(f"정보: 생성된 복사본 파일 '{copy_filepath}'을(를) 삭제했습니다.")
             return

        # --- 지정 범위 추출 ---
        # 줄 번호를 0부터 시작하는 인덱스로 조정
        start_index = start_line - 1
        # 파이썬 슬라이싱은 끝 인덱스를 포함하지 않으므로 end_line 그대로 사용
        end_index = end_line
        extracted_lines = source_lines[start_index:end_index]

        # --- 추출된 부분 저장 ---
        with open(part_filepath, 'w', encoding='utf-8') as f:
            f.writelines(extracted_lines)

        print(f"성공: '{source_file}'의 {start_line}-{end_line} 줄을 추출하여 '{part_filepath}'에 저장했습니다.")
        print(f"이제 '{part_filepath}' 파일을 수정한 후, 'insert_edited_part.py' 스크립트를 사용하세요.")
        print(f"수정 대상 복사본: {copy_filepath}")

    except Exception as e:
        print(f"오류 발생: {e}")
        # 오류 발생 시 생성된 파일들 삭제 시도
        if os.path.exists(copy_filepath):
            try:
                os.remove(copy_filepath)
                print(f"정보: 오류로 인해 생성된 복사본 파일 '{copy_filepath}'을(를) 삭제했습니다.")
            except OSError:
                pass # 이미 삭제되었거나 권한 문제 등
        if os.path.exists(part_filepath):
             try:
                os.remove(part_filepath)
                print(f"정보: 오류로 인해 생성된 추출 파일 '{part_filepath}'을(를) 삭제했습니다.")
             except OSError:
                pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="파일을 복사하고 특정 라인 범위를 추출하여 수정용 파일을 만듭니다.")
    parser.add_argument("source_file", help="수정할 원본 파일 경로")
    parser.add_argument("start_line", type=int, help="추출 시작 줄 번호 (1부터 시작)")
    parser.add_argument("end_line", type=int, help="추출 끝 줄 번호 (1부터 시작)")

    args = parser.parse_args()

    extract_for_edit(args.source_file, args.start_line, args.end_line)

    # 사용 예시:
    # python util/extract_for_edit.py path/to/your/large_file.js 100 250 