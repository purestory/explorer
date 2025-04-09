#!/usr/bin/env python3
import re
import sys
import os
from collections import defaultdict

def find_function_declarations(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.readlines()
    
    function_declarations = []
    brace_count = 0
    in_function = False
    current_function = None
    start_line = None
    
    # 정규식 패턴: 함수 선언 찾기 (async 포함)
    function_pattern = re.compile(r'^\s*(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(')
    
    for i, line in enumerate(content, 1):
        # 함수 선언 시작 찾기
        if not in_function:
            match = function_pattern.search(line)
            if match:
                current_function = match.group(2)
                start_line = i
                in_function = True
                brace_count = line.count('{') - line.count('}')
                
                # 한 줄 안에 함수가 끝나는 경우
                if brace_count == 0 and '{}' in line:
                    function_declarations.append((current_function, start_line, i))
                    in_function = False
                    current_function = None
                    
        # 함수 내부 분석
        else:
            brace_count += line.count('{') - line.count('}')
            
            # 함수 끝 찾기
            if brace_count == 0:
                function_declarations.append((current_function, start_line, i))
                in_function = False
                current_function = None
    
    return function_declarations

def detect_duplicates(declarations):
    function_dict = defaultdict(list)
    
    # 함수 이름별로 선언 위치 수집
    for name, start, end in declarations:
        function_dict[name].append((start, end))
    
    # 중복 함수만 필터링
    duplicates = {name: positions for name, positions in function_dict.items() if len(positions) > 1}
    
    return duplicates

def main():
    if len(sys.argv) != 2:
        print(f"사용법: {sys.argv[0]} <자바스크립트_파일_경로>")
        sys.exit(1)
    
    js_file = sys.argv[1]
    if not os.path.exists(js_file):
        print(f"파일이 존재하지 않습니다: {js_file}")
        sys.exit(1)
    
    # 파일 절대 경로 가져오기
    abs_file_path = os.path.abspath(js_file)
    file_name = os.path.basename(js_file)
    
    declarations = find_function_declarations(js_file)
    duplicates = detect_duplicates(declarations)
    
    print(f"중복 함수 목록 (총 {len(duplicates)} 개 함수 발견):")
    for name, positions in sorted(duplicates.items(), key=lambda x: x[0]):
        print(f"\n함수: {name} (총 {len(positions)}번 선언)")
        for i, (start, end) in enumerate(positions, 1):
            print(f"  {i}번째 선언: {start}행 ~ {end}행 ({end-start+1}행 길이)")
    
    # 삭제할 함수 리스트 생성
    delete_commands = []
    for name, positions in duplicates.items():
        # 마지막 선언을 제외한 모든 선언을 삭제 대상으로 지정
        for start, end in positions[:-1]:
            delete_commands.append((start, end))
    
    # 삭제 명령을 행 번호 역순으로 정렬 (큰 행 번호부터 삭제)
    delete_commands.sort(reverse=True)
    
    print("\n삭제할 함수 블록 목록:")
    for start, end in delete_commands:
        print(f"  {start}행 ~ {end}행 삭제")
    
    # 고유 ID를 가진 삭제 스크립트 이름 생성
    output_script = f"util/remove_duplicates_{file_name.replace('.', '_')}.py"
    
    # 삭제 명령 스크립트 생성
    with open(output_script, "w", encoding="utf-8") as f:
        f.write(f"""#!/usr/bin/env python3
import sys
import os

def remove_lines(file_path, ranges, target_file):
    # 안전장치: 지정된 파일만 처리
    if os.path.abspath(file_path) != target_file:
        print(f"오류: 이 스크립트는 '{{target_file}}' 파일에 대해서만 사용할 수 있습니다.")
        print(f"      제공된 파일: '{{os.path.abspath(file_path)}}'")
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 원본 파일 백업
    with open(file_path + '.bak', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    # 역순으로 정렬된 범위에서 지정된 행 삭제
    for start, end in ranges:
        del lines[start-1:end]
    
    # 수정된 내용 저장
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print(f"삭제 완료. 총 {{len(ranges)}}개 블록 제거됨")
    return True

# 이 스크립트가 대상으로 하는 파일 경로
TARGET_FILE = "{abs_file_path}"

# 삭제할 행 범위 (시작행, 끝행)
ranges = [
""")
        for start, end in delete_commands:
            f.write(f"    ({start}, {end}),\n")
        f.write(f"""]

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f"사용법: {{sys.argv[0]}} <파일_경로>")
        print(f"참고: 이 스크립트는 '{{TARGET_FILE}}' 파일의 중복 함수를 제거하기 위해 생성되었습니다.")
        sys.exit(1)
    
    js_file = sys.argv[1]
    
    if remove_lines(js_file, ranges, TARGET_FILE):
        print(f"'{{js_file}}' 파일의 중복 함수 제거 완료")
    else:
        print("작업이 중단되었습니다.")
""")
    
    print(f"\n삭제 스크립트 생성 완료: {output_script}")
    print("다음 명령으로 중복 함수를 삭제할 수 있습니다:")
    print(f"  python3 {output_script} {js_file}")

if __name__ == '__main__':
    main() 