#!/usr/bin/env python3
import argparse
import re
import os
import logging
import json
import sys
import traceback

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def find_function_bounds(lines, start_line_idx):
    """
    특정 라인부터 시작하는 함수의 끝 라인을 찾습니다.
    
    Args:
        lines (list): 파일의 모든 라인 목록
        start_line_idx (int): 함수 시작 라인 인덱스 (0 기반)
        
    Returns:
        tuple: (시작 라인 번호, 끝 라인 번호) - 1 기반
    """
    brace_level = 0
    arrow_function = False
    in_block_comment = False
    
    # 함수 시작 라인에서 화살표 함수인지 확인
    for i in range(start_line_idx, min(start_line_idx + 10, len(lines))): 
        line = lines[i]
        
        # 주석 처리
        if in_block_comment:
            if '*/' in line:
                line = line.split('*/', 1)[1]
                in_block_comment = False
            else:
                continue
        if '/*' in line:
            if '*/' not in line.split('/*', 1)[1]:
                in_block_comment = True
            line = line.split('/*', 1)[0]
        
        # 한 줄 주석 제거
        if '//' in line:
            line = line.split('//', 1)[0]
            
        # 화살표 함수 확인
        if '=>' in line:
            arrow_function = True
            
        # 중괄호 찾기
        if '{' in line:
            break
            
    # 중괄호 수준 계산 시작
    for i in range(start_line_idx, len(lines)):
        line = lines[i]
        
        # 주석 처리
        if in_block_comment:
            if '*/' in line:
                line = line.split('*/', 1)[1]
                in_block_comment = False
            else:
                continue
        if '/*' in line:
            if '*/' not in line.split('/*', 1)[1]:
                in_block_comment = True
            line = line.split('/*', 1)[0]
        
        # 한 줄 주석 제거
        if '//' in line:
            line = line.split('//', 1)[0]
        
        # 화살표 함수에서 중괄호 없이 한 줄로 된 경우 처리
        if arrow_function and '=>' in line and '{' not in line:
            # 중괄호 없이 표현식만 있는 화살표 함수
            return (start_line_idx + 1, i + 1)  # 1 기반 라인 번호
            
        # 괄호 수준 갱신
        brace_level += line.count('{')
        brace_level -= line.count('}')
        
        # 함수 끝 감지 (괄호 수준이 0이 되면 종료)
        if brace_level > 0:  # 괄호가 시작됨
            if i == start_line_idx:  # 시작 라인에서 괄호가 시작된 경우
                pass
        elif brace_level == 0 and i > start_line_idx:  # 괄호가 끝남
            # 세미콜론이나 닫는 괄호 다음 세미콜론까지 포함
            if ');' in line or '});' in line:
                return (start_line_idx + 1, i + 1)  # 1 기반 라인 번호
            
            # 닫는 괄호만 있는 경우 다음 라인까지 확인 (세미콜론이 있는지)
            if i + 1 < len(lines) and (');' in lines[i+1] or '});' in lines[i+1]):
                return (start_line_idx + 1, i + 2)  # 세미콜론까지 포함
            
            return (start_line_idx + 1, i + 1)  # 1 기반 라인 번호
    
    # 파일 끝까지 도달한 경우
    return (start_line_idx + 1, len(lines))  # 1 기반 라인 번호

def is_in_comment(original_line):
    """
    해당 라인이 주석 내부에 있는지 더 정확하게 확인합니다.
    
    Args:
        original_line (str): 원본 라인
        
    Returns:
        bool: 주석 내부에 있으면 True, 아니면 False
    """
    trimmed = original_line.strip()
    
    # 라인이 // 주석으로 시작하는 경우
    if trimmed.startswith('//'):
        return True
    
    # 라인이 /* 주석으로 시작하는 경우
    if trimmed.startswith('/*'):
        return True
    
    # addEventListener 앞에 주석이 있는지 확인
    pos_add = original_line.find('addEventListener')
    if pos_add != -1:
        pos_comment1 = original_line.find('//', 0, pos_add)
        pos_comment2 = original_line.find('/*', 0, pos_add)
        if pos_comment1 != -1 or pos_comment2 != -1:
            return True
            
    # * 주석 내용 라인인 경우
    if trimmed.startswith('*') and not trimmed.startswith('*/'):
        return True
        
    return False

def process_comments(line, in_comment):
    """
    주석 처리 상태를 추적합니다.
    
    Args:
        line (str): 현재 처리 중인 줄
        in_comment (bool): 현재 블록 주석 내부에 있는지 여부
        
    Returns:
        bool: 이 줄을 처리한 후 블록 주석 내부에 있는지 여부
    """
    if in_comment:
        if '*/' in line:
            return False
        return True
    else:
        if '/*' in line:
            if '*/' in line.split('/*', 1)[1]:
                return False
            return True
    return False

def extract_third_arg(line, next_lines):
    """
    addEventListener 호출의 3번째 인자(옵션 객체)를 추출합니다.
    
    Args:
        line (str): 현재 줄의 텍스트
        next_lines (list): 뒤따르는 줄 목록 (3번째 인자가 여러 줄에 걸쳐 있을 경우)
    
    Returns:
        str 또는 None: 3번째 인자 텍스트 또는 None (3번째 인자가 없는 경우)
    """
    try:
        # 먼저 단일 라인에서 3번째 인자를 찾는 패턴
        pattern = r'\.addEventListener\s*\(\s*[\'"]([^\'"]+)[\'"][^,]*,\s*([^,]+?),\s*(.+?)(?=\)[;\s]|$)'
        match = re.search(pattern, line)
        
        if match:
            third_arg = match.group(3).strip()
            
            # 객체 리터럴이 시작되고 닫히지 않은 경우, 다음 줄들을 확인
            if '{' in third_arg and third_arg.count('{') > third_arg.count('}'):
                open_count = third_arg.count('{') - third_arg.count('}')
                temp_arg = third_arg
                
                for i, next_line in enumerate(next_lines):
                    if i > 10:  # 최대 10줄까지만 확인
                        break
                        
                    temp_arg += ' ' + next_line.strip()
                    open_count += next_line.count('{') - next_line.count('}')
                    
                    if open_count <= 0:
                        # 닫는 괄호 이후 부분 제거
                        if ')' in next_line:
                            closing_pos = next_line.find(')')
                            temp_arg = temp_arg[:-len(next_line)] + next_line[:closing_pos].strip()
                        break
                
                third_arg = temp_arg.strip()
            
            return third_arg
        
        # 기본 패턴으로 찾지 못한 경우, 다음 줄까지 확인
        # 두 번째 인자 후에 쉼표가 있는 경우
        if '.addEventListener' in line and ',' in line:
            parts = line.split(',')
            if len(parts) >= 2 and ')' not in parts[-1]:
                # 다음 줄 확인
                for i, next_line in enumerate(next_lines):
                    next_line = next_line.strip()
                    
                    # 3번째 인자로 보이는 패턴 확인: 객체 리터럴, true, false
                    if (next_line.startswith('{') or 
                        next_line == 'true' or 
                        next_line == 'false' or 
                        '{' in next_line.split('//')[0] if '//' in next_line else next_line):
                        
                        # 객체 리터럴이면 닫는 중괄호까지 추적
                        if '{' in next_line:
                            brace_count = next_line.count('{') - next_line.count('}')
                            arg = next_line
                            
                            if brace_count > 0:
                                # 객체가 닫히지 않았으면 후속 라인 확인
                                for j, subsequent_line in enumerate(next_lines[i+1:]):
                                    if j > 10:  # 최대 10줄
                                        break
                                        
                                    arg += ' ' + subsequent_line.strip()
                                    brace_count += subsequent_line.count('{') - subsequent_line.count('}')
                                    
                                    if brace_count <= 0:
                                        # 닫는 괄호 이후 부분 제거
                                        if ')' in subsequent_line:
                                            closing_pos = subsequent_line.find(')')
                                            arg = arg[:-len(subsequent_line)] + subsequent_line[:closing_pos].strip()
                                        break
                            
                            return arg.strip()
                        
                        return next_line
        
        return None
        
    except Exception as e:
        logging.error(f"3번째 인자 추출 중 오류 발생: {str(e)}")
        traceback.print_exc(file=sys.stderr)
        return None

def find_event_listeners(js_file_path, event_type=None):
    """
    JavaScript 파일에서 모든 addEventListener 호출을 찾아 정보를 반환합니다.
    
    Args:
        js_file_path (str): 검색할 JavaScript 파일 경로
        event_type (str, optional): 필터링할 이벤트 타입 (예: 'click', 'change' 등)
    
    Returns:
        list: 발견된 이벤트 리스너 정보 목록. 각 항목은 dictionary로,
            {
                'element': str,          # 이벤트가 추가된 요소 식별자 (예: 'document', '#myButton')
                'event_type': str,       # 이벤트 타입 (예: 'click', 'change')
                'line_number': int,      # addEventListener 호출이 발견된 줄 번호
                'callback': str,         # 콜백 함수 (함수 이름 또는 함수 정의)
                'callback_start': int,   # 콜백 함수 시작 줄 번호 (함수 정의인 경우)
                'callback_end': int,     # 콜백 함수 종료 줄 번호 (함수 정의인 경우)
                'third_arg': str         # 추가 옵션 (3번째 인자가 있는 경우)
            }
    """
    listener_pattern = r'([a-zA-Z0-9_$.\[\]\'\"#]+)\.addEventListener\s*\(\s*[\'"]([^\'"]+)[\'"]'
    result = []
    
    try:
        if not os.path.exists(js_file_path):
            logging.error(f"파일을 찾을 수 없음: {js_file_path}")
            return result
            
        with open(js_file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
            
        # 모든 줄을 처리
        for i, line in enumerate(lines):
            line_number = i + 1
            
            # 주석 줄 건너뛰기
            if line.strip().startswith('//'):
                continue
                
            # addEventListener 호출 찾기
            matches = re.finditer(listener_pattern, line)
            for match in matches:
                element = match.group(1)
                current_event_type = match.group(2)
                
                # 특정 이벤트 타입으로 필터링 (설정된 경우)
                if event_type and current_event_type != event_type:
                    continue
                    
                # 다음 줄들 (콜백 함수나 3번째 인자가 여러 줄에 걸쳐 있을 수 있음)
                next_lines = lines[i+1:i+10] if i+1 < len(lines) else []
                
                # 콜백 함수와 범위 추출
                callback, callback_start, callback_end = extract_callback_function(line, next_lines, js_file_path, line_number)
                
                # 3번째 인자 (옵션 객체) 추출
                third_arg = extract_third_arg(line, next_lines)
                
                listener_info = {
                    'element': element,
                    'event_type': current_event_type,
                    'line_number': line_number,
                    'callback': callback,
                    'callback_start': callback_start,
                    'callback_end': callback_end,
                    'third_arg': third_arg
                }
                
                result.append(listener_info)
                
        return result
        
    except Exception as e:
        logging.error(f"이벤트 리스너 검색 중 오류 발생: {str(e)}")
        return result

def extract_function_name(listener_info):
    """
    리스너 정보에서 함수 이름을 추출합니다.
    """
    code = listener_info['code']
    
    # 화살표 함수나 익명 함수 처리
    if '=>' in code or 'function(' in code or 'function (' in code:
        return f"anonymous_listener_line_{listener_info['line']}"
    
    # 함수 이름 추출 시도
    function_match = re.search(r'addEventListener\s*\(\s*[\'\"].+?[\'\"],\s*([\w.]+)', code)
    if function_match:
        return function_match.group(1)
    
    # 기본값
    return f"event_listener_line_{listener_info['line']}"

def is_named_function(callback):
    """
    콜백이 명명된 함수인지 확인합니다.
    
    Args:
        callback (str): 콜백 함수 코드나 이름
        
    Returns:
        bool: 명명된 함수이면 True, 익명 함수이면 False
    """
    if not callback:
        return False
        
    # 화살표 함수나 'function' 키워드가 있으면 익명 함수로 간주
    if '=>' in callback or 'function(' in callback or 'function (' in callback:
        return False
        
    # 그 외의 경우 명명된 함수로 간주
    return True

def extract_callback_function(line, next_lines, js_file_path, line_number):
    """
    addEventListener의 콜백 함수와 그 범위를 추출합니다.
    
    Args:
        line (str): 현재 라인 텍스트
        next_lines (list): 다음 라인들의 목록
        js_file_path (str): JavaScript 파일 경로
        line_number (int): 현재 라인 번호
        
    Returns:
        tuple: (콜백 함수 텍스트, 시작 라인 번호, 끝 라인 번호)
    """
    try:
        # addEventListener 호출에서 두 번째 인자(콜백 함수) 추출 정규식
        pattern = r'\.addEventListener\s*\(\s*[\'"]([^\'"]+)[\'"][^,]*,\s*([^,]+)(?:,|\))'
        match = re.search(pattern, line)
        
        if not match:
            return None, None, None
            
        callback = match.group(2).strip()
        
        # 콜백이 함수 선언인 경우 (화살표 함수 또는 function 키워드)
        if '=>' in callback or 'function' in callback:
            # 콜백 함수가 현재 라인에서 시작하지만 끝나지 않는 경우
            if callback.count('{') > callback.count('}'):
                with open(js_file_path, 'r', encoding='utf-8') as file:
                    all_lines = file.readlines()
                
                # 함수 범위 찾기
                start_idx = line_number - 1
                start_line, end_line = find_function_bounds(all_lines, start_idx)
                
                # 함수 전체 코드 구성
                full_callback = callback
                for i in range(1, end_line - start_line):
                    if start_idx + i < len(all_lines):
                        full_callback += ' ' + all_lines[start_idx + i].strip()
                
                return full_callback, start_line, end_line
            
            # 콜백 함수가 현재 라인에서 완료되는 경우
            return callback, line_number, line_number
        
        # 콜백이 함수 이름인 경우
        # 세미콜론이나 닫는 괄호로 끝나는 경우 제거
        if callback.endswith(')') or callback.endswith(';'):
            callback = callback.rstrip(');')
        
        return callback.strip(), None, None
        
    except Exception as e:
        logging.error(f"콜백 함수 추출 중 오류 발생: {str(e)}")
        traceback.print_exc(file=sys.stderr)
        return None, None, None

def main():
    """
    명령줄 인터페이스 메인 함수
    """
    parser = argparse.ArgumentParser(description='JavaScript 파일에서 addEventListener 호출을 찾습니다.')
    parser.add_argument('js_file', help='검색할 JavaScript 파일 경로')
    parser.add_argument('--event-type', help='특정 이벤트 타입으로 필터링 (예: click, submit)')
    parser.add_argument('--output', help='결과를 저장할 파일 경로')
    parser.add_argument('--quick', action='store_true', help='간단한 결과만 출력 (모든 일치하는 이벤트)')
    parser.add_argument('--verbose', action='store_true', help='상세한 로그 출력')
    
    args = parser.parse_args()
    
    # 로깅 설정
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=log_level, format='%(levelname)s: %(message)s')
    
    # 이벤트 리스너 검색
    listeners = find_event_listeners(args.js_file, args.event_type)
    
    if args.quick:
        # 간단한 결과만 출력 - 모든 일치하는 이벤트 표시
        if listeners:
            for listener in listeners:
                element = listener['element']
                event_type = listener['event_type']
                line_number = listener['line_number']
                callback = listener['callback'] or "익명 함수"
                third_arg = f", 세 번째 인자: {listener['third_arg']}" if listener['third_arg'] else ""
                
                print(f"라인 {line_number}: {element}.addEventListener('{event_type}', {callback}{third_arg})")
        else:
            print(f"'{args.js_file}'에서 이벤트 리스너를 찾을 수 없습니다.")
    else:
        # 모든 정보 출력
        print(f"\n*** '{args.js_file}'에서 찾은 이벤트 리스너 ***\n")
        
        if not listeners:
            print("이벤트 리스너를 찾을 수 없습니다.")
        else:
            for i, listener in enumerate(listeners, 1):
                print(f"\n[이벤트 리스너 #{i}]")
                print(f"요소: {listener['element']}")
                print(f"이벤트 타입: {listener['event_type']}")
                print(f"라인 번호: {listener['line_number']}")
                
                if listener['callback']:
                    callback_type = "함수명" if is_named_function(listener['callback']) else "익명 함수"
                    print(f"콜백: {callback_type} - {listener['callback']}")
                    
                    if listener['callback_start'] and listener['callback_end']:
                        print(f"콜백 함수 범위: {listener['callback_start']} - {listener['callback_end']}")
                else:
                    print("콜백: 추출 불가")
                
                if listener['third_arg']:
                    print(f"세 번째 인자: {listener['third_arg']}")
    
    # 결과를 파일로 저장 (--output 옵션이 제공된 경우)
    if args.output:
        output_dir = os.path.dirname(args.output)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(listeners, f, indent=2, ensure_ascii=False)
            logging.info(f"결과가 '{args.output}'에 저장되었습니다.")

if __name__ == "__main__":
    main() 