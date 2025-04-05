import argparse
import os

UTIL_DIR = "util"

def insert_edited_part(copy_file, start_line, end_line, edited_part_file, output_file=None):
    """
    복사본 파일의 특정 라인 범위를 수정된 파일 내용으로 교체합니다.

    Args:
        copy_file (str): 수정 대상 복사본 파일 경로 (util 폴더 내).
        start_line (int): 교체 시작 줄 번호 (1부터 시작).
        end_line (int): 교체 끝 줄 번호 (1부터 시작).
        edited_part_file (str): 사용자가 수정한 코드가 담긴 파일 경로.
        output_file (str, optional): 결과를 저장할 파일 경로.
                                     지정하지 않으면 복사본 파일(copy_file)을 덮어씁니다. Defaults to None.
    """
    # --- 입력값 유효성 검사 ---
    if not os.path.exists(copy_file):
        print(f"오류: 복사본 파일 '{copy_file}'을(를) 찾을 수 없습니다. '{UTIL_DIR}' 폴더 안에 있어야 합니다.")
        return
    if not os.path.exists(edited_part_file):
        print(f"오류: 수정된 부분 파일 '{edited_part_file}'을(를) 찾을 수 없습니다.")
        return
    if not isinstance(start_line, int) or not isinstance(end_line, int) or start_line <= 0 or end_line <= 0:
        print("오류: 시작 줄과 끝 줄 번호는 0보다 큰 정수여야 합니다.")
        return
    if start_line > end_line:
        print("오류: 시작 줄 번호는 끝 줄 번호보다 클 수 없습니다.")
        return

    try:
        # --- 복사본 파일 읽기 ---
        with open(copy_file, 'r', encoding='utf-8') as f:
            copy_lines = f.readlines()

        # 지정된 줄 번호가 파일 범위를 벗어나는지 확인
        if start_line > len(copy_lines) or end_line > len(copy_lines):
             print(f"오류: 지정된 줄 번호 ({start_line}-{end_line})가 복사본 파일 총 줄 수({len(copy_lines)})를 벗어납니다.")
             return

        # --- 수정된 부분 읽기 ---
        with open(edited_part_file, 'r', encoding='utf-8') as f:
            edited_lines = f.readlines()

        # --- 새로운 내용 준비 ---
        # 줄 번호를 0부터 시작하는 인덱스로 조정
        start_index = start_line - 1
        # 파이썬 슬라이싱은 끝 인덱스를 포함하지 않으므로 end_line 그대로 사용
        end_index = end_line

        prefix = copy_lines[:start_index] # 시작 줄 이전까지의 내용
        suffix = copy_lines[end_index:]   # 끝 줄 이후부터의 내용

        new_lines = prefix + edited_lines + suffix

        # --- 출력 파일 경로 결정 ---
        target_file = output_file if output_file else copy_file

        # --- 결과 파일 쓰기 ---
        with open(target_file, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)

        if target_file == copy_file:
            print(f"성공: '{copy_file}'의 {start_line}-{end_line} 줄이 '{edited_part_file}' 내용으로 교체되었습니다.")
            print(f"이제 수동으로 '{copy_file}' 파일을 원래 위치로 복사하세요 (필요시 sudo 사용).")
        else:
             print(f"성공: 수정된 내용이 '{target_file}'에 저장되었습니다.")

    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="복사본 파일의 특정 라인 범위를 수정된 파일 내용으로 교체합니다.")
    parser.add_argument("copy_file", help="수정 대상 복사본 파일 경로 (util 폴더 내, 예: util/myfile.js.copy)")
    parser.add_argument("start_line", type=int, help="교체 시작 줄 번호 (1부터 시작)")
    parser.add_argument("end_line", type=int, help="교체 끝 줄 번호 (1부터 시작)")
    parser.add_argument("edited_part_file", help="사용자가 수정한 코드가 담긴 파일 경로 (예: util/myfile.js.part_to_edit)")
    parser.add_argument("-o", "--output", dest="output_file", help="결과를 저장할 파일 경로 (지정하지 않으면 복사본 파일을 덮어씁니다)")

    args = parser.parse_args()

    insert_edited_part(args.copy_file, args.start_line, args.end_line, args.edited_part_file, args.output_file)

    # 사용 예시:
    # python util/insert_edited_part.py util/large_file.js.copy 100 250 util/large_file.js.part_to_edit
    # python util/insert_edited_part.py util/my_script.py.copy 5 15 util/my_script.py.part_to_edit -o final_script.py 