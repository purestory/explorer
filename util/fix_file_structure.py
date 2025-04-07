#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import sys

# 공유 폴더 경로
SHARE_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', 'share-folder')

def get_candidate_files(folder_path):
    """폴더 내의 파일 목록을 반환"""
    try:
        if not os.path.isdir(folder_path):
            return []
        return [f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))]
    except Exception as e:
        print(f"폴더 내용 확인 중 오류: {e} (경로: {folder_path})")
        return []

def should_fix_folder(folder_path):
    """이 폴더가 수정 대상인지 확인"""
    folder_name = os.path.basename(folder_path)
    files = get_candidate_files(folder_path)
    
    # 두 가지 케이스를 확인
    # 1. 폴더 이름과 동일한 파일이 하나만 있는 경우
    if len(files) == 1 and files[0] == folder_name:
        return True, os.path.join(folder_path, files[0])
    
    # 2. 폴더 이름이 해시값처럼 보이고 파일이 하나만 있는 경우
    if len(files) == 1 and len(folder_name) > 30:
        return True, os.path.join(folder_path, files[0])
    
    # 3. 다른 수정 조건들도 여기에 추가 가능
    
    return False, None

def fix_structure(start_path=SHARE_FOLDER, dry_run=True):
    """잘못된 파일 구조를 수정"""
    fixed_count = 0
    
    for root, dirs, files in os.walk(start_path, topdown=False):
        for dir_name in dirs:
            folder_path = os.path.join(root, dir_name)
            
            should_fix, file_path = should_fix_folder(folder_path)
            if should_fix:
                file_name = os.path.basename(file_path)
                target_path = os.path.join(root, file_name)
                
                if dry_run:
                    print(f"[가상 수정] 이동: {file_path} -> {target_path}")
                else:
                    try:
                        # 파일 이동
                        temp_path = os.path.join(root, f"_temp_{file_name}")
                        shutil.copy2(file_path, temp_path)
                        
                        # 폴더 삭제
                        shutil.rmtree(folder_path)
                        
                        # 임시 파일 이름 변경
                        os.rename(temp_path, target_path)
                        
                        print(f"수정 완료: {target_path}")
                        fixed_count += 1
                    except Exception as e:
                        print(f"수정 실패: {folder_path} - {e}")
    
    return fixed_count

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--fix":
        print("실제 수정 모드로 실행합니다. 잠시 기다려주세요...")
        count = fix_structure(dry_run=False)
        print(f"총 {count}개 항목 수정 완료")
    else:
        print("가상 수정 모드로 실행합니다. 실제 변경은 이루어지지 않습니다.")
        print("실제로 수정하려면 --fix 옵션을 추가하세요.")
        count = fix_structure(dry_run=True)
        print(f"총 {count}개 항목이 수정 대상으로 확인되었습니다.")

if __name__ == "__main__":
    main() 