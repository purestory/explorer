#!/bin/bash

# 로그 파일 경로 정의
ERROR_LOG="backend/logs/error.log"
SERVER_LOG="backend/logs/server.log"
SYSTEMD_ERROR_LOG="backend/logs/systemd-error.log"
SYSTEMD_LOG="backend/logs/systemd.log"
NGINX_ERROR_LOG="/var/log/nginx/error.log" # Nginx 오류 로그 추가

# 출력 디렉토리
OUTPUT_DIR="tmp"
mkdir -p "$OUTPUT_DIR" # tmp 디렉토리가 없으면 생성

# 마지막 줄 수
NUM_LINES=200

echo "로그 파일 마지막 ${NUM_LINES}줄 추출하여 개별 파일로 저장 시작..."

# 각 로그 파일의 출력 파일 경로 정의
ERROR_LOG_TAIL="$OUTPUT_DIR/error_log_tail.txt"
SERVER_LOG_TAIL="$OUTPUT_DIR/server_log_tail.txt"
SYSTEMD_ERROR_LOG_TAIL="$OUTPUT_DIR/systemd_error_log_tail.txt"
SYSTEMD_LOG_TAIL="$OUTPUT_DIR/systemd_log_tail.txt"
NGINX_ERROR_LOG_TAIL="$OUTPUT_DIR/nginx_error_log_tail.txt"


# 1. error.log 처리
echo "처리 중: ${ERROR_LOG} -> ${ERROR_LOG_TAIL}"
if [ -f "$ERROR_LOG" ]; then
  sudo tail -n "$NUM_LINES" "$ERROR_LOG" > "$ERROR_LOG_TAIL"
  echo " -> 저장 완료"
else
  echo " -> 실패: ${ERROR_LOG} 파일을 찾을 수 없습니다."
  echo "File not found: ${ERROR_LOG}" > "$ERROR_LOG_TAIL" # 실패 시 파일에 메시지 기록
fi

# 2. server.log 처리
echo "처리 중: ${SERVER_LOG} -> ${SERVER_LOG_TAIL}"
if [ -f "$SERVER_LOG" ]; then
  sudo tail -n "$NUM_LINES" "$SERVER_LOG" > "$SERVER_LOG_TAIL"
  echo " -> 저장 완료"
else
  echo " -> 실패: ${SERVER_LOG} 파일을 찾을 수 없습니다."
  echo "File not found: ${SERVER_LOG}" > "$SERVER_LOG_TAIL"
fi

# 3. systemd-error.log 처리
echo "처리 중: ${SYSTEMD_ERROR_LOG} -> ${SYSTEMD_ERROR_LOG_TAIL}"
if [ -f "$SYSTEMD_ERROR_LOG" ]; then
  sudo tail -n "$NUM_LINES" "$SYSTEMD_ERROR_LOG" > "$SYSTEMD_ERROR_LOG_TAIL"
  echo " -> 저장 완료"
else
  echo " -> 실패: ${SYSTEMD_ERROR_LOG} 파일을 찾을 수 없습니다."
  echo "File not found: ${SYSTEMD_ERROR_LOG}" > "$SYSTEMD_ERROR_LOG_TAIL"
fi

# 4. systemd.log 처리
echo "처리 중: ${SYSTEMD_LOG} -> ${SYSTEMD_LOG_TAIL}"
if [ -f "$SYSTEMD_LOG" ]; then
  sudo tail -n "$NUM_LINES" "$SYSTEMD_LOG" > "$SYSTEMD_LOG_TAIL"
  echo " -> 저장 완료"
else
  echo " -> 실패: ${SYSTEMD_LOG} 파일을 찾을 수 없습니다."
  echo "File not found: ${SYSTEMD_LOG}" > "$SYSTEMD_LOG_TAIL"
fi

# 5. Nginx error.log 처리 (추가)
echo "처리 중: ${NGINX_ERROR_LOG} -> ${NGINX_ERROR_LOG_TAIL}"
if [ -f "$NGINX_ERROR_LOG" ]; then
  sudo tail -n "$NUM_LINES" "$NGINX_ERROR_LOG" > "$NGINX_ERROR_LOG_TAIL"
  echo " -> 저장 완료"
else
  echo " -> 실패: ${NGINX_ERROR_LOG} 파일을 찾을 수 없습니다."
  echo "File not found: ${NGINX_ERROR_LOG}" > "$NGINX_ERROR_LOG_TAIL"
fi


echo "로그 개별 추출 완료. ${OUTPUT_DIR} 디렉토리를 확인하세요." 