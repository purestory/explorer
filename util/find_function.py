# util/find_function.py
#!/usr/bin/env python3
import argparse
import re
import os
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def find_function_code(js_file_path, function_name):
    """
    JavaScript 파일에서 지정된 함수의 코드 블록과 라인 번호를 찾습니다.
    주석, 다양한 함수 선언 방식, 괄호 중첩 등을 고려하여 정확도를 높였습니다.

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
        logging.error(f"파일을 찾을 수 없습니다 - {js_file_path}")
        return None, -1, -1
    except Exception as e:
        logging.error(f"파일을 읽는 중 문제가 발생했습니다 - {e}")
        return None, -1, -1

    # 함수 이름 이스케이프
    escaped_function_name = re.escape(function_name)

    # 다양한 함수 정의 패턴 개선 (주석/공백 유연성 강화, 화살표 함수/메서드 정의 추가)
    patterns = [
        # 기본 function 선언 (async 포함)
        re.compile(r'^\s*(async\s+)?function\s+' + escaped_function_name + r'\s*\(', re.IGNORECASE),
        # 변수/상수 할당 함수 (async 포함, 화살표 함수 포함)
        re.compile(r'^\s*(?:const|let|var)\s+' + escaped_function_name + r'\s*=\s*(async\s+)?(\(.*\)|[a-zA-Z0-9_]+)\s*=>\s*\{', re.IGNORECASE),
        re.compile(r'^\s*(?:const|let|var)\s+' + escaped_function_name + r'\s*=\s*(async\s+)?function\s*\(', re.IGNORECASE),
        # 객체 메서드 정의 (축약형 포함, async 포함)
        re.compile(r'^\s*(async\s+)?' + escaped_function_name + r'\s*\((?!.*\s*=>)', re.IGNORECASE), # 화살표 함수와 구분
        re.compile(r'^\s*' + escaped_function_name + r'\s*:\s*(async\s+)?function\s*\(', re.IGNORECASE),
        # 클래스 메서드 정의 (async 포함, 생성자 제외)
        re.compile(r'^\s*(static\s+)?(async\s+)?' + escaped_function_name + r'\s*\(', re.IGNORECASE),
    ]

    start_line = -1
    brace_level = 0
    function_code_lines = []
    in_block_comment = False

    logging.info(f"'{js_file_path}' 파일에서 '{function_name}' 함수 검색 시작...")

    for i, raw_line in enumerate(lines):
        line = raw_line.strip() # 앞뒤 공백 제거 후 처리

        # 주석 처리 (여러 줄 주석 포함)
        if in_block_comment:
            if '*/' in line:
                line = line.split('*/', 1)[1]
                in_block_comment = False
            else:
                continue # 블록 주석 내부 라인 건너뛰기
        if '/*' in line:
            if '*/' not in line.split('/*', 1)[1]: # 한 줄에 블록 주석 시작/끝이 없는 경우
                 in_block_comment = True
            line = line.split('/*', 1)[0] # 블록 주석 시작 부분 제거

        # 한 줄 주석 제거
        if '//' in line:
            line = line.split('//', 1)[0]

        # 빈 줄이나 주석만 있는 줄 건너뛰기 (함수 시작 전)
        if start_line == -1 and not line:
            continue

        if start_line == -1:
            # 함수 시작 찾기 (주석 제거된 라인 기준)
            for pattern in patterns:
                # 주의: 패턴이 라인 시작 부분과 일치하는지 확인 (^\s*)
                if pattern.match(line): # search 대신 match 사용
                    logging.info(f"라인 {i + 1}에서 함수 시작 패턴 감지: {raw_line.strip()}")
                    start_line = i + 1 # 1기반 라인 번호

                    # 괄호 레벨 계산 시작
                    open_braces = raw_line.count('{')
                    close_braces = raw_line.count('}')
                    brace_level = open_braces - close_braces
                    function_code_lines.append(raw_line) # 원본 라인 저장

                    # 함수가 한 줄에 정의된 경우 ({ } 괄호 쌍 확인)
                    if brace_level == 0 and open_braces > 0 :
                         end_line = start_line
                         logging.info(f"라인 {end_line}에서 함수 끝 감지 (한 줄 함수)")
                         return "".join(function_code_lines), start_line, end_line
                    # 괄호 레벨이 음수거나 0이지만 '{'가 없는 경우 (잘못된 시작)
                    elif brace_level < 0 or (brace_level == 0 and open_braces == 0):
                         logging.warning(f"라인 {i + 1}에서 함수 시작으로 의심되나, 괄호 불일치 또는 '{'{'}' 누락으로 초기화.")
                         start_line = -1 # 잘못된 시작이므로 초기화
                         function_code_lines = []
                    break # 패턴 매칭 성공 시 더 이상 다른 패턴 검사 안함

        elif start_line != -1:
            # 함수 내부 라인 처리
            function_code_lines.append(raw_line) # 원본 라인 저장
            brace_level += raw_line.count('{')
            brace_level -= raw_line.count('}')

            # 함수 끝 감지 (괄호 레벨이 0 이하가 되면 종료)
            if brace_level <= 0:
                end_line = i + 1 # 1기반 라인 번호
                logging.info(f"라인 {end_line}에서 함수 끝 감지 (괄호 레벨 {brace_level})")
                return "".join(function_code_lines), start_line, end_line

    # 파일 끝까지 도달한 경우
    if start_line == -1:
        logging.error(f"'{function_name}' 함수를 찾을 수 없습니다.")
        return None, -1, -1
    elif brace_level > 0:
         logging.warning(f"'{function_name}' 함수의 닫는 괄호 '}}'를 찾지 못했습니다 (파일 끝 도달, 괄호 레벨: {brace_level}). 마지막 라인까지 반환합니다.")
         return "".join(function_code_lines), start_line, len(lines) # 찾은 시작점부터 파일 끝까지 반환

    logging.error(f"알 수 없는 오류로 '{function_name}' 함수 처리 실패.")
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
        logging.info(f"생성된 디렉토리: {output_dir}")

    function_code, start, end = find_function_code(args.js_file, args.function_name)

    if function_code:
        try:
            with open(args.output_file, 'w', encoding='utf-8') as f:
                f.write(function_code)
            logging.info(f"'{args.function_name}' 함수의 코드를 '{args.output_file}' 파일에 저장했습니다.")
            logging.info(f"원본 파일 '{args.js_file}' 내 위치:")
            logging.info(f"시작 라인: {start}")
            logging.info(f"끝 라인: {end}")
        except Exception as e:
            logging.error(f"추출된 코드를 파일에 쓰는 중 문제가 발생했습니다 - {e}")

if __name__ == "__main__":
    main() 