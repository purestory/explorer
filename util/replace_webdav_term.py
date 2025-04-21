import os
import re
import argparse

# 제외할 디렉토리 이름
EXCLUDED_DIRS = {'.git', 'node_modules', 'tmp', 'backup', '.vscode', '.cursor'}
# 제외할 파일 확장자 (바이너리, 이미지, 폰트, 압축 파일 등)
EXCLUDED_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot',
    '.zip', '.gz', '.tar', '.bz2', '.rar', '.7z',
    '.map', '.lock', # 소스맵, 락파일
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', # 문서
    '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.wmv', # 미디어
    # 필요시 추가
}
# 처리할 텍스트 기반 파일 확장자 (이 목록에 없거나 확장자가 없는 파일도 일단 시도)
TEXT_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.html', '.htm', '.xhtml',
    '.css', '.scss', '.sass', '.less',
    '.json', '.xml', '.yaml', '.yml',
    '.md', '.txt',
    '.py', '.sh', '.bash', '.zsh',
    '.service', '.conf', '.config', '.ini', '.toml',
    '.nginx', # Nginx 설정 파일
    '.gitignore', '.npmrc', '.editorconfig',
    # 필요시 추가
}

def should_skip(dirpath, name):
    """주어진 경로와 이름이 처리 대상에서 제외되어야 하는지 확인"""
    # 절대 경로 생성
    fullpath = os.path.join(dirpath, name)

    # 디렉토리 제외
    if os.path.isdir(fullpath) and name in EXCLUDED_DIRS:
        return True

    # 파일 확장자 기반 제외
    if os.path.isfile(fullpath):
        _, ext = os.path.splitext(name)
        ext_lower = ext.lower()
        if ext_lower in EXCLUDED_EXTENSIONS:
            # print(f"Skipping excluded extension: {fullpath}")
            return True
        # 텍스트 확장자 목록에 없고, 확장자가 존재하면 일단 제외 (안전 장치)
        # 확장자 없는 파일 (예: Dockerfile, LICENSE)은 처리 시도
        # if ext_lower not in TEXT_EXTENSIONS and ext_lower:
        #     print(f"Skipping non-text extension (heuristic): {fullpath}")
        #     return True

    # 숨김 파일/디렉토리 제외 ('.'으로 시작하는 것, .git 등은 이미 EXCLUDED_DIRS에 있음)
    # if name.startswith('.') and name != '.gitignore': # .gitignore는 처리해야 함
    #     return True

    return False

def replace_explorer(content):
    """콘텐츠 내 'explorer'를 'explorer'로 변경 (대소문자 유지)"""
    # 정규 표현식 콜백 함수: explorer -> Explorer, explorer -> explorer
    def replacer(match):
        word = match.group(0)
        # 'explorer' 또는 첫 글자만 대문자인 경우 -> 'Explorer'
        if word[0].isupper():
            return 'Explorer'
        # 소문자 'explorer' -> 'explorer'
        else:
            return 'explorer'
        # 참고: 'explorer' 전체 대문자는 거의 없을 것으로 가정하고 'Explorer'로 처리

    # 'explorer'를 대소문자 구분 없이 찾아 replacer 함수로 치환
    # \b는 단어 경계를 의미하여 'myexplorer' 같은 단어 중간은 바꾸지 않음
    pattern = re.compile(r'\bexplorer\b', re.IGNORECASE)
    new_content, count = pattern.subn(replacer, content)
    return new_content, count > 0 # 변경 여부 반환

def process_file(filepath):
    """파일을 읽고, 변경사항 적용 후 다시 저장"""
    try:
        # 파일 인코딩 감지 시도 (chardet 라이브러리가 있다면 더 좋음)
        encodings_to_try = ['utf-8', 'latin-1', 'cp949'] # 필요시 다른 인코딩 추가
        content = None
        detected_encoding = None

        for enc in encodings_to_try:
            try:
                with open(filepath, 'r', encoding=enc) as f:
                    content = f.read()
                detected_encoding = enc
                break
            except UnicodeDecodeError:
                continue
            except Exception as e:
                # 파일 읽기 중 다른 오류 발생 시 건너뛰기
                print(f"Skipping file due to read error ({enc}): {filepath} - {e}")
                return False

        if content is None:
            print(f"Skipping file: Could not decode {filepath} with {encodings_to_try}")
            return False

    except Exception as e:
        print(f"Skipping file due to error: {filepath} - {e}")
        return False

    new_content, changed = replace_explorer(content)

    if changed:
        try:
            with open(filepath, 'w', encoding=detected_encoding) as f:
                f.write(new_content)
            print(f"Modified: {filepath} (Encoding: {detected_encoding})")
            return True
        except Exception as e:
            print(f"Error writing file: {filepath} - {e}")
            return False
    else:
        # 변경 없는 파일은 메시지 출력 안 함 (로그 간결화)
        # print(f"No changes needed: {filepath}")
        return False

def main(root_dir):
    """지정된 디렉토리부터 시작하여 파일 내용 변경 작업 수행"""
    modified_count = 0
    processed_files = 0
    skipped_dirs = set()

    print(f"Starting replacement in directory: {root_dir}")
    print(f"Excluded directories: {EXCLUDED_DIRS}")
    print(f"Excluded extensions: {EXCLUDED_EXTENSIONS}")
    print("-" * 30)

    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=True):
        # 현재 디렉토리 경로가 제외 대상 디렉토리로 시작하는지 확인 (더 효율적)
        is_excluded_dir = False
        for excluded in EXCLUDED_DIRS:
             # 상대 경로로 비교하기 위해 root_dir 제거
            relative_dirpath = os.path.relpath(dirpath, root_dir)
            if relative_dirpath.startswith(excluded):
                is_excluded_dir = True
                if dirpath not in skipped_dirs:
                    # print(f"Skipping directory: {dirpath}")
                    skipped_dirs.add(dirpath)
                break
        if is_excluded_dir:
            dirnames[:] = [] # 하위 디렉토리 탐색 중단
            filenames[:] = [] # 현재 디렉토리 파일 처리 중단
            continue

        # os.walk가 반환하는 dirnames 리스트를 직접 수정하여 하위 탐색 제어
        original_dirnames = list(dirnames)
        dirnames[:] = [d for d in original_dirnames if not should_skip(dirpath, d)]
        # 건너뛴 디렉토리 기록
        skipped_now = set(original_dirnames) - set(dirnames)
        for skipped_d in skipped_now:
            full_skipped_path = os.path.join(dirpath, skipped_d)
            if full_skipped_path not in skipped_dirs:
                 # print(f"Skipping directory: {full_skipped_path}")
                 skipped_dirs.add(full_skipped_path)


        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if should_skip(dirpath, filename):
                # print(f"Skipping file: {filepath}")
                continue

            processed_files += 1
            if process_file(filepath):
                modified_count += 1

    print("-" * 30)
    print(f"Replacement complete.")
    print(f"Processed files: {processed_files}")
    print(f"Modified files: {modified_count}")
    print(f"Skipped directories (and their contents): {len(skipped_dirs)}")
    print("-" * 30)
    print("IMPORTANT: Please review the changes carefully using 'git status' or 'git diff'.")
    print("File/directory *names* containing 'explorer' were NOT modified.")

if __name__ == "__main__":
    # 프로젝트 루트 디렉토리에서 실행되는 것을 가정
    # 필요시 argparse로 경로 입력받도록 수정 가능
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    print(f"Detected project root: {project_root}")
    main(project_root) 