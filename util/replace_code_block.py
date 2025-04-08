# util/replace_code_block.py
import argparse
import os
import shutil
import datetime

def create_backup(file_path):
    """
    파일의 백업을 생성합니다. (예: file.js -> file.js.20231027_103000.bak)
    """
    if not os.path.exists(file_path):
        print(f"경고: 백업할 원본 파일을 찾을 수 없습니다 - {file_path}")
        return None

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file_path = f"{file_path}.{timestamp}.bak"

    try:
        shutil.copy2(file_path, backup_file_path) # 메타데이터 보존 복사
        print(f"원본 파일 백업 생성: {backup_file_path}")
        return backup_file_path
    except Exception as e:
        print(f"오류: 파일 백업 중 문제가 발생했습니다 - {e}")
        return None


def replace_code(target_file_path, replacement_file_path, start_line, end_line):
    """
    대상 파일의 지정된 라인 범위를 다른 파일의 내용으로 교체합니다. (백업 생성 포함)

    Args:
        target_file_path (str): 수정할 대상 파일 경로
        replacement_file_path (str): 삽입할 코드가 있는 파일 경로
        start_line (int): 삭제를 시작할 라인 번호 (1기반)
        end_line (int): 삭제를 끝낼 라인 번호 (1기반)

    Returns:
        bool: 성공 여부
    """
    if not os.path.exists(target_file_path):
        print(f"오류: 대상 파일을 찾을 수 없습니다 - {target_file_path}")
        return False
    if not os.path.exists(replacement_file_path):
        print(f"오류: 교체할 코드 파일을 찾을 수 없습니다 - {replacement_file_path}")
        return False

    if start_line <= 0 or end_line <= 0 or start_line > end_line:
        print(f"오류: 라인 번호가 잘못되었습니다 (시작: {start_line}, 끝: {end_line}). 1 이상의 양수여야 하며, 시작 <= 끝 이어야 합니다.")
        return False

    # 1. 백업 생성
    backup_path = create_backup(target_file_path)
    if not backup_path:
        print("백업 생성 실패로 작업을 중단합니다.")
        return False

    try:
        # 2. 대상 파일 읽기
        with open(target_file_path, 'r', encoding='utf-8') as f:
            target_lines = f.readlines()

        # 3. 교체할 코드 읽기
        with open(replacement_file_path, 'r', encoding='utf-8') as f:
            replacement_code = f.read() # 전체 내용을 문자열로 읽음

    except Exception as e:
        print(f"오류: 파일을 읽는 중 문제가 발생했습니다 - {e}")
        # 실패 시 백업 복원 시도 (선택적)
        # try:
        #     shutil.copy2(backup_path, target_file_path)
        #     print(f"오류 발생으로 백업 파일 복원 시도: {backup_path} -> {target_file_path}")
        # except Exception as restore_e:
        #     print(f"백업 복원 중 오류 발생: {restore_e}")
        return False

    # 4. 라인 번호 유효성 검사
    if start_line > len(target_lines): # 끝 라인 검사는 start_line > end_line 조건에서 이미 처리됨
        print(f"오류: 시작 라인 번호({start_line})가 파일의 총 라인 수({len(target_lines)})를 초과합니다.")
        return False
    # end_line이 파일 끝을 넘어가도 마지막 라인까지만 삭제하도록 허용 (end_index 계산 시 처리)

    # 5. 코드 교체
    # 0기반 인덱스로 변환
    start_index = start_line - 1
    # end_line이 파일 길이를 넘어도 괜찮도록 조정
    end_index = min(end_line, len(target_lines))

    # 새로운 내용 생성: 시작 전 + 교체 코드 + 끝 이후
    new_lines = target_lines[:start_index]
    # replacement_code가 여러 줄일 수 있으므로 lines로 변환 후 extend
    new_lines.extend(replacement_code.splitlines(True)) # 개행 문자 유지하며 분리
    new_lines.extend(target_lines[end_index:])

    try:
        # 6. 원본 파일 덮어쓰기
        with open(target_file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines) # 변경된 라인 리스트를 다시 씀
        print(f"'{target_file_path}' 파일의 라인 {start_line}-{end_line}이(가) '{replacement_file_path}'의 내용으로 성공적으로 교체되었습니다.")
        return True
    except Exception as e:
        print(f"오류: 수정된 내용을 파일에 쓰는 중 문제가 발생했습니다 - {e}")
        # 실패 시 백업 복원 시도 (선택적)
        # try:
        #     shutil.copy2(backup_path, target_file_path)
        #     print(f"파일 쓰기 오류 발생으로 백업 파일 복원 시도: {backup_path} -> {target_file_path}")
        # except Exception as restore_e:
        #     print(f"백업 복원 중 오류 발생: {restore_e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="대상 파일의 지정된 라인 범위를 다른 파일의 내용으로 교체합니다. (백업 생성)")
    parser.add_argument("target_file", help="수정할 대상 JavaScript 파일 경로")
    parser.add_argument("replacement_file", help="삽입할 코드가 담긴 파일 경로")
    parser.add_argument("start_line", type=int, help="삭제를 시작할 라인 번호 (1기반)")
    parser.add_argument("end_line", type=int, help="삭제를 끝낼 라인 번호 (1기반)")
    args = parser.parse_args()

    replace_code(args.target_file, args.replacement_file, args.start_line, args.end_line)

if __name__ == "__main__":
    main() 