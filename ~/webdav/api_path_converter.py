#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import datetime
from pathlib import Path

def main():
    """
    /api/ 경로를 /webdav-api/로 변경하는 스크립트
    """
    print("WebDAV API 경로 변환 스크립트 ('/api/' -> '/webdav-api/')")
    print("======================================================")
    
    # 작업 디렉토리 설정 (webdav 루트 디렉토리)
    webdav_root = Path.home() / "webdav"
    os.chdir(webdav_root)
    
    # 백업 디렉토리 생성
    backup_dir = webdav_root / "tmp" / f"backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    print(f"백업 디렉토리 생성: {backup_dir}")
    
    # 변경할 파일 목록
    files_to_modify = [
        Path("backend/server.js"),
        Path("frontend/script.js"),
        Path("frontend/_redirects")
    ]
    
    # 변경 수행
    total_replacements = 0
    
    for file_path in files_to_modify:
        if not file_path.exists():
            print(f"파일을 찾을 수 없음: {file_path}")
            continue
        
        # 파일 백업
        backup_file = backup_dir / file_path.name
        shutil.copy2(file_path, backup_file)
        print(f"백업 생성: {backup_file}")
        
        # 파일 내용 읽기
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 변경 전 API 경로 횟수 카운트
        old_count = content.count('/api/')
        
        # 내용 변경
        new_content = content.replace('/api/', '/webdav-api/')
        
        # 변경된 내용 저장
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"파일 변경 완료: {file_path} (변경 건수: {old_count})")
        total_replacements += old_count
    
    # Nginx 설정 파일 처리 (선택 사항)
    nginx_config = Path("/etc/nginx/sites-enabled/purestory")
    if nginx_config.exists():
        print("\nNginx 설정 파일 처리:")
        print("sudo sed -i 's|/api/|/webdav-api/|g' /etc/nginx/sites-enabled/purestory")
        print("sudo systemctl reload nginx")
    
    print("\n변환 완료!")
    print(f"총 {total_replacements}개의 API 경로가 변경되었습니다.")
    print(f"모든 파일이 백업되었습니다: {backup_dir}")
    print("변경 사항을 적용하려면 다음 작업이 필요합니다:")
    print("1. Node.js 서버 재시작")
    print("2. Netlify 사이트 재배포")

if __name__ == "__main__":
    main() 