#!/usr/bin/env python3
import sys
import os

def delete_lines(file_path, start_line, end_line):
    """
    파일에서 지정된 범위의 라인을 삭제합니다.
    
    Args:
        file_path (str): 파일 경로
        start_line (int): 삭제 시작 라인 번호 (1부터 시작)
        end_line (int): 삭제 끝 라인 번호 (포함)
    """
    # 파일이 존재하는지 확인
    if not os.path.exists(file_path):
        print(f"오류: 파일 '{file_path}'이 존재하지 않습니다.")
        return False
    
    # 파일 읽기
    with open(file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    # 범위 확인
    if start_line < 1 or end_line > len(lines) or start_line > end_line:
        print(f"오류: 유효하지 않은 라인 범위입니다. 파일 크기: {len(lines)}줄, 요청 범위: {start_line}-{end_line}")
        return False
    
    # 라인 삭제 (인덱스는 0부터 시작하므로 1을 빼줌)
    del lines[start_line - 1:end_line]
    
    # 파일 다시 쓰기
    with open(file_path, 'w', encoding='utf-8') as file:
        file.writelines(lines)
    
    print(f"성공: {file_path}에서 {start_line}~{end_line}줄까지 삭제했습니다.")
    return True

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("사용법: python delete_lines.py 파일경로 시작라인 끝라인")
        sys.exit(1)
    
    try:
        file_path = sys.argv[1]
        start_line = int(sys.argv[2])
        end_line = int(sys.argv[3])
        
        result = delete_lines(file_path, start_line, end_line)
        sys.exit(0 if result else 1)
    except ValueError:
        print("오류: 시작라인과 끝라인은 정수여야 합니다.")
        sys.exit(1)
    except Exception as e:
        print(f"오류: {str(e)}")
        sys.exit(1) 