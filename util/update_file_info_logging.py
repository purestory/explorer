#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import os
import sys

def update_file_logging(filepath):
    """
    파일 업로드 시 콘솔 로그를 파일/폴더 요약 정보로 대체하는 함수
    """
    try:
        # 파일 읽기
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 파일 수집 완료 로그 부분을 찾아 파일/폴더 개수를 출력하는 코드로 교체
        target_pattern = r'console\.log\(`총 \$\{filesWithPaths.length\}개의 파일 수집 완료\.\`\);'
        
        replacement = """// 파일과 폴더 개수 계산
        let fileCount = 0;
        let folderCount = 0;
        const uniqueFolders = new Set();

        filesWithPaths.forEach(({ file, relativePath }) => {
            fileCount++;
            
            // 상대 경로에 폴더가 포함되어 있는지 확인
            if (relativePath.includes('/')) {
                // 경로의 각 부분을 추출하고 고유 폴더 경로 저장
                const parts = relativePath.split('/');
                let currentPath = '';
                
                // 마지막 부분(파일명)을 제외하고 모든 폴더 경로 추가
                for (let i = 0; i < parts.length - 1; i++) {
                    if (i === 0) {
                        currentPath = parts[i];
                    } else {
                        currentPath += '/' + parts[i];
                    }
                    uniqueFolders.add(currentPath);
                }
            }
        });

        folderCount = uniqueFolders.size;
        
        // 요약 정보만 콘솔에 출력
        console.log(`업로드 준비: 파일 ${fileCount}개${folderCount > 0 ? `, 폴더 ${folderCount}개` : ''} 수집 완료.`);"""
        
        # 정규식으로 패턴 찾아 교체
        modified_content = re.sub(target_pattern, replacement, content)
        
        # 변경 사항 저장
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(modified_content)
        
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
    
    # 파일 로깅 업데이트
    if update_file_logging(filepath):
        print("성공적으로 완료되었습니다.")
    else:
        print("스크립트 실행 중 오류가 발생했습니다.")
        sys.exit(1) 