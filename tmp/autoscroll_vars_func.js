// ===== 자동 스크롤 관련 전역 변수 (추가) =====
let autoScrollIntervalId = null; // requestAnimationFrame ID
let scrollDirection = 0; // -1: 위로, 1: 아래로, 0: 정지
let currentScrollSpeed = 0; // 현재 스크롤 속도 (px/frame)
const scrollZoneHeight = 50; // 스크롤 발동 영역 높이 (px)
const minScrollSpeed = 2;    // 최소 스크롤 속도
const maxScrollSpeed = 20;   // 최대 스크롤 속도

// scrollLoop 함수 정의 (추가)
function scrollLoop() {
    if (scrollDirection === 0) {
        autoScrollIntervalId = null; // 스크롤 멈추면 ID 초기화
        return;
    }
    const fileList = document.getElementById('fileList');
    if (fileList) { // fileList가 존재하는지 확인
        fileList.scrollTop += scrollDirection * currentScrollSpeed;
    } else {
        // fileList가 없으면 스크롤 중지
        if (autoScrollIntervalId !== null) {
            cancelAnimationFrame(autoScrollIntervalId);
            autoScrollIntervalId = null;
            scrollDirection = 0;
        }
        return;
    }
    
    // 다음 프레임 요청
    autoScrollIntervalId = requestAnimationFrame(scrollLoop);
} 