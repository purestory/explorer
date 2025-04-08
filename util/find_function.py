# util/find_function.py
import argparse
import re
import os

def find_function_code(js_file_path, function_name):
    """
    JavaScript 파일에서 지정된 함수의 코드 블록과 라인 번호를 찾습니다.

    Args:
        js_file_path (str): JavaScript 파일 경로
        function_name (str): 찾을 함수의 이름

    Returns:
        tuple: (추출된 함수 코드, 시작 라인 번호, 끝 라인 번호) 또는 (None, -1, -1)
    """
    try:
        with open(js_file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"오류: 파일을 찾을 수 없습니다 - {js_file_path}")
        return None, -1, -1
    except Exception as e:
        print(f"오류: 파일을 읽는 중 문제가 발생했습니다 - {e}")
        return None, -1, -1

    # 다양한 함수 정의 패턴을 포함하는 정규 표현식
    patterns = [
        re.compile(r'^\s*function\s+' + re.escape(function_name) + r'\s*\(.*?\)\s*\{', re.IGNORECASE),
        re.compile(r'^\s*(?:const|let|var)\s+' + re.escape(function_name) + r'\s*=\s*\(.*?\)\s*=>\s*\{', re.IGNORECASE),
        re.compile(r'^\s*' + re.escape(function_name) + r'\s*:\s*function\s*\(.*?\)\s*\{', re.IGNORECASE),
        re.compile(r'^\s*(?:async\s+)?' + re.escape(function_name) + r'\s*\((?:.|\s)*?\)\s*\{', re.IGNORECASE),
        re.compile(r'^\s*' + re.escape(function_name) + r'\s*=\s*function\s*\(.*?\)\s*\{', re.IGNORECASE),
        re.compile(r'^\s*' + re.escape(function_name) + r'\s*=\s*\(.*?\)\s*=>\s*\{', re.IGNORECASE),
    ]

    start_line = -1
    brace_level = 0
    function_code_lines = []

    for i, line in enumerate(lines):
        if start_line == -1:
            for pattern in patterns:
                if pattern.search(line):
                    start_line = i + 1 # 1기반 라인 번호
                    brace_level = line.count('{') - line.count('}')
                    function_code_lines.append(line)
                    if brace_level == 0 and '{' in line and '}' in line.split('{', 1)[1]:
                         end_line = start_line
                         return "".join(function_code_lines), start_line, end_line
                    elif brace_level <= 0 and '{' in line:
                        pass
                    break
        elif start_line != -1:
            function_code_lines.append(line)
            brace_level += line.count('{')
            brace_level -= line.count('}')
            if brace_level <= 0:
                end_line = i + 1 # 1기반 라인 번호
                return "".join(function_code_lines), start_line, end_line

    if start_line == -1:
        print(f"오류: '{function_name}' 함수를 찾을 수 없습니다.")
        return None, -1, -1
    elif brace_level > 0:
         print(f"오류: '{function_name}' 함수의 닫는 괄호 '}}'를 찾지 못했습니다. (파일 끝 도달)")
         return "".join(function_code_lines), start_line, len(lines)

    return None, -1, -1

def main():
    parser = argparse.ArgumentParser(description="JavaScript 파일에서 함수 코드를 찾아 파일로 저장하고 위치를 출력합니다.")
    parser.add_argument("js_file", help="검색할 JavaScript 파일 경로")
    parser.add_argument("function_name", help="찾을 함수의 이름")
    parser.add_argument("output_file", help="추출된 코드를 저장할 파일 경로")
    args = parser.parse_args()

    output_dir = os.path.dirname(args.output_file)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"생성된 디렉토리: {output_dir}")

    function_code, start, end = find_function_code(args.js_file, args.function_name)

    if function_code:
        try:
            with open(args.output_file, 'w', encoding='utf-8') as f:
                f.write(function_code)
            print(f"'{args.function_name}' 함수의 코드를 '{args.output_file}' 파일에 저장했습니다.")
            print(f"원본 파일 '{args.js_file}' 내 위치:")
            print(f"시작 라인: {start}")
            print(f"끝 라인: {end}")
        except Exception as e:
            print(f"오류: 추출된 코드를 파일에 쓰는 중 문제가 발생했습니다 - {e}")

if __name__ == "__main__":
    main() 