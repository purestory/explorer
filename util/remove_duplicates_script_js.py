#!/usr/bin/env python3
import sys
import os

def remove_lines(file_path, ranges, target_file):
    # 안전장치: 지정된 파일만 처리
    if os.path.abspath(file_path) != target_file:
        print(f"오류: 이 스크립트는 '{target_file}' 파일에 대해서만 사용할 수 있습니다.")
        print(f"      제공된 파일: '{os.path.abspath(file_path)}'")
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
    
    print(f"삭제 완료. 총 {len(ranges)}개 블록 제거됨")
    return True

# 이 스크립트가 대상으로 하는 파일 경로
TARGET_FILE = "/home/purestory/webdav/frontend/script.js"

# 삭제할 행 범위 (시작행, 끝행)
ranges = [
    (5491, 5499),
    (5413, 5422),
    (4838, 4922),
    (4775, 4832),
    (4752, 4772),
    (4742, 4749),
    (4716, 4739),
    (4687, 4713),
    (4606, 4684),
    (4570, 4603),
    (4553, 4567),
    (4548, 4550),
    (4539, 4545),
    (4498, 4536),
    (4428, 4494),
    (4341, 4425),
    (4315, 4338),
    (4270, 4312),
    (4051, 4267),
    (3829, 4046),
    (3600, 3621),
    (3559, 3597),
    (3552, 3557),
    (3508, 3550),
    (3432, 3461),
    (3380, 3429),
    (3270, 3354),
    (3158, 3215),
    (3135, 3155),
    (3125, 3132),
    (3099, 3122),
    (3070, 3096),
    (2989, 3067),
    (2953, 2986),
    (2936, 2950),
    (2931, 2933),
    (2922, 2928),
    (2881, 2919),
    (2811, 2877),
    (2727, 2808),
    (2701, 2724),
    (2656, 2698),
    (2437, 2653),
    (2215, 2432),
    (1986, 2007),
    (1666, 1698),
    (1594, 1663),
    (1551, 1591),
    (1518, 1547),
    (1439, 1486),
    (1384, 1436),
    (1333, 1381),
    (1306, 1330),
    (1300, 1303),
    (1290, 1297),
]

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f"사용법: {sys.argv[0]} <파일_경로>")
        print(f"참고: 이 스크립트는 '{TARGET_FILE}' 파일의 중복 함수를 제거하기 위해 생성되었습니다.")
        sys.exit(1)
    
    js_file = sys.argv[1]
    
    if remove_lines(js_file, ranges, TARGET_FILE):
        print(f"'{js_file}' 파일의 중복 함수 제거 완료")
    else:
        print("작업이 중단되었습니다.")
