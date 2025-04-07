#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import os
import sys

def hide_file_logs(filepath):
    """
    파일 트리 탐색 중 개별 파일 및 폴더 추가 로그를 주석 처리하는 함수
    """
    try:
        # 파일 읽기
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 파일 추가 로그 주석 처리
        content = content.replace(
            'console.log(`파일 추가: ${relativePath}`);', 
            '// console.log(`파일 추가: ${relativePath}`);'
        )
        
        # 폴더 탐색 로그 주석 처리
        content = content.replace(
            'console.log(`폴더 탐색: ${currentPath}`);', 
            '// console.log(`폴더 탐색: ${currentPath}`);'
        )
        
        # 숨김 파일 제외 로그 주석 처리
        content = content.replace(
            'console.log(`숨김 파일 제외: ${currentPath}`);', 
            '// console.log(`숨김 파일 제외: ${currentPath}`);'
        )
        
        # 숨김 폴더 제외 로그 주석 처리 
        content = content.replace(
            'console.log(`숨김 폴더 제외: ${currentPath}`);', 
            '// console.log(`숨김 폴더 제외: ${currentPath}`);'
        )
        
        # 변경 사항 저장
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"파일이 성공적으로 수정되었습니다: {filepath}")
        return True
    
    except Exception as e:
        print(f"오류 발생: {e}")
        return False

if __name__ == "__main__":
    # 기본 파일 경로 설정
    filepath = "frontend/script.js"
    
    # 커맨드 라인 인자가 제공된 경우 사용
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    
    # 파일 존재 확인
    if not os.path.exists(filepath):
        print(f"오류: 파일을 찾을 수 없습니다: {filepath}")
        sys.exit(1)
    
    # 파일 로그 숨기기
    if hide_file_logs(filepath):
        print("성공적으로 완료되었습니다.")
    else:
        print("스크립트 실행 중 오류가 발생했습니다.")
        sys.exit(1) 