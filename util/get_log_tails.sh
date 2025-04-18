#!/bin/bash

# 로그 디렉토리 설정
LOG_DIR="/home/purestory/webdav/backend/logs"
TMP_DIR="/home/purestory/webdav/backend/tmp"

# tmp 디렉토리가 없으면 생성
mkdir -p "$TMP_DIR"

# 각 로그 파일에서 마지막 100줄 추출
tail -n 100 "$LOG_DIR/error.log" > "$TMP_DIR/error_log_tail.txt"
tail -n 100 "$LOG_DIR/server.log" > "$TMP_DIR/server_log_tail.txt"
tail -n 100 "$LOG_DIR/systemd-error.log" > "$TMP_DIR/systemd_error_log_tail.txt"
tail -n 100 "$LOG_DIR/systemd.log" > "$TMP_DIR/systemd_log_tail.txt"

# nginx 에러 로그도 추출 (위치가 다를 수 있음)
sudo tail -n 100 /var/log/nginx/error.log > "$TMP_DIR/nginx_error_log_tail.txt"

echo "로그 파일 추출 완료. $TMP_DIR 디렉토리에서 확인하세요."
