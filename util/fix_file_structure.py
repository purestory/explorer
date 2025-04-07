#!/usr/bin/env python3
import os
import shutil
import sys

def is_directory_like_file(dir_path):
    """
    디렉토리 이름이 파일 확장자를 가지고 있는지 확인하고, 
    내부에 동일한 이름의 파일이 있는지 확인합니다.
    """
    dir_name = os.path.basename(dir_path)
    
    # 확장자 확인 (일반적인 파일 확장자 목록)
    file_extensions = [
        '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp', '.webp',
        '.mp3', '.wav', '.mp4', '.avi', '.mov', '.mkv',
        '.zip', '.rar', '.7z', '.tar', '.gz', '.json', '.xml',
        '.html', '.htm', '.css', '.js', '.php', '.py', '.java', '.c', '.cpp', '.cs'
    ]
    
    has_ext = any(dir_name.lower().endswith(ext) for ext in file_extensions)
    if not has_ext:
        return False, None
    
    # 동일한 이름의 파일이 존재하는지 확인
    if not os.path.isdir(dir_path):
        return False, None
    
    files = os.listdir(dir_path)
    for file in files:
        file_path = os.path.join(dir_path, file)
        if os.path.isfile(file_path) and file == dir_name:
            return True, file_path
    
    return False, None

def fix_directory_structure(root_path):
    """
    디렉토리 구조를 수정합니다.
    디렉토리 이름이 파일 확장자를 가지고 있고 내부에 같은 이름의 파일이 있으면,
    파일을 상위 디렉토리로 이동하고 원래 디렉토리를 삭제합니다.
    """
    fixed_count = 0
    error_count = 0
    
    items = os.listdir(root_path)
    
    for item in items:
        item_path = os.path.join(root_path, item)
        
        # 디렉토리인 경우만 확인
        if not os.path.isdir(item_path):
            continue
        
        # 디렉토리가 파일처럼 보이는지 확인
        is_dir_like_file, file_path = is_directory_like_file(item_path)
        
        if is_dir_like_file and file_path:
            # 이름과 경로 결정
            dir_name = os.path.basename(item_path)
            target_path = os.path.join(root_path, dir_name)
            temp_path = os.path.join(root_path, f"temp_{dir_name}")
            
            print(f"수정 중: {item_path}")
            
            try:
                # 임시 파일 이름으로 복사
                print(f"  파일을 임시로 복사: {file_path} -> {temp_path}")
                shutil.copy2(file_path, temp_path)
                
                # 원본 디렉토리 삭제 (먼저 디렉토리 완전히 비우기)
                print(f"  디렉토리 삭제 준비: {item_path}")
                for sub_item in os.listdir(item_path):
                    sub_path = os.path.join(item_path, sub_item)
                    if os.path.isfile(sub_path):
                        os.remove(sub_path)
                        print(f"    파일 삭제: {sub_path}")
                
                os.rmdir(item_path)
                print(f"  디렉토리 삭제 완료: {item_path}")
                
                # 임시 파일을 최종 위치로 이동
                print(f"  임시 파일을 최종 위치로 이동: {temp_path} -> {target_path}")
                shutil.move(temp_path, target_path)
                
                fixed_count += 1
                print(f"  수정 완료: {item_path} -> {target_path}")
            except Exception as e:
                print(f"  오류 발생: {str(e)}")
                # 오류 발생 시 임시 파일 정리 시도
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                        print(f"  임시 파일 정리: {temp_path}")
                    except:
                        pass
                error_count += 1
    
    return fixed_count, error_count

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"사용법: {sys.argv[0]} <디렉토리_경로>")
        sys.exit(1)
    
    root_path = sys.argv[1]
    
    if not os.path.exists(root_path) or not os.path.isdir(root_path):
        print(f"오류: {root_path}는 유효한 디렉토리가 아닙니다.")
        sys.exit(1)
    
    print(f"디렉토리 구조 수정 시작: {root_path}")
    fixed_count, error_count = fix_directory_structure(root_path)
    print(f"수정 완료: {fixed_count}개 항목 수정, {error_count}개 오류 발생") 