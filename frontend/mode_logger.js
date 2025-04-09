// frontend/mode_logger.js

const MODE_OPERATING = 'operating';
const MODE_DEVELOPMENT = 'development';
const MODE_STORAGE_KEY = 'appMode';

// 현재 모드를 sessionStorage에서 직접 읽어옴 (항상 최신 값 보장)
function getCurrentMode() {
    // sessionStorage 값이 없거나 유효하지 않으면 운영 모드를 기본값으로 반환
    const mode = sessionStorage.getItem(MODE_STORAGE_KEY);
    return mode === MODE_DEVELOPMENT ? MODE_DEVELOPMENT : MODE_OPERATING;
}

/**
 * 현재 모드를 설정하고 sessionStorage에 저장합니다.
 */
function setMode(mode) {
    if (mode === MODE_OPERATING || mode === MODE_DEVELOPMENT) {
        sessionStorage.setItem(MODE_STORAGE_KEY, mode);
        const updatedMode = getCurrentMode(); // 저장 후 다시 읽어 확인
        console.log(`[ModeLogger] Mode changed to: ${updatedMode}`); // 이 로그는 항상 출력됩니다.
        // UI 업데이트 함수 호출
        if (window.updateToggleButtonState) {
             window.updateToggleButtonState();
        } else {
            console.warn("[ModeLogger] updateToggleButtonState function not found during setMode.");
        }
    } else {
        console.error(`[ModeLogger] Invalid mode specified: ${mode}`);
    }
}

/**
 * 현재 모드를 반환합니다. (외부 사용 용도)
 */
function getMode() {
    return getCurrentMode();
}

/**
 * 운영 모드와 개발 모드를 토글합니다.
 */
function toggleMode() {
    const current = getCurrentMode();
    const newMode = current === MODE_OPERATING ? MODE_DEVELOPMENT : MODE_OPERATING;
    setMode(newMode);
}

// 조건부 로그 출력을 위한 래퍼 함수들
// getMode()를 사용하여 항상 최신 모드 상태를 확인

function logDebug(...args) {
    if (getMode() === MODE_DEVELOPMENT) {
        console.debug('[DEBUG]', ...args); // 레벨 표시 추가
    }
}

function logInfo(...args) {
    if (getMode() === MODE_DEVELOPMENT) {
        console.info('[INFO]', ...args); // 레벨 표시 추가
    }
}

function logWarn(...args) {
    if (getMode() === MODE_DEVELOPMENT) {
        console.warn('[WARN]', ...args); // 레벨 표시 추가
    }
}

// logLog 함수에도 명시적으로 모드 확인 로직 추가 및 console.log 사용
function logLog(...args) {
    if (getMode() === MODE_DEVELOPMENT) {
        console.log('[LOG]', ...args); // console.log 사용 및 레벨 표시
    }
}

// console.error는 항상 출력되어야 하므로, 레벨 표시만 추가
const logError = (...args) => {
    console.error('[ERROR]', ...args); // 레벨 표시 추가
};

// 페이지 로드 시 초기 모드 설정 및 로그 출력 (console.log는 항상 실행)
console.log(`[ModeLogger] Initial mode loaded: ${getCurrentMode()}`);

// 전역 스코프에 함수 노출
window.toggleAppMode = toggleMode;
window.getAppMode = getMode;
window.logDebug = logDebug;
window.logInfo = logInfo;
window.logWarn = logWarn;
window.logLog = logLog;
window.logError = logError;
// window.updateToggleButtonState 는 script.js에서 정의되므로 여기서는 정의 확인만
window.updateToggleButtonState = window.updateToggleButtonState || function() {
    console.warn("[ModeLogger] updateToggleButtonState placeholder called on load.");
};

// 초기 버튼 상태 업데이트 시도 (DOMContentLoaded 사용 유지)
document.addEventListener('DOMContentLoaded', () => {
    if (window.updateToggleButtonState) {
        // updateToggleButtonState 함수가 script.js에서 정의된 후 호출되도록 보장
        // 약간의 지연을 주어 script.js의 초기화 로직과 충돌 방지
        setTimeout(() => {
            try {
                 window.updateToggleButtonState();
                 console.log("[ModeLogger] Initial toggle button state updated via DOMContentLoaded.");
            } catch (error) {
                 console.error("[ModeLogger] Error calling updateToggleButtonState on DOMContentLoaded:", error);
            }
        }, 0);
    } else {
         console.warn("[ModeLogger] updateToggleButtonState not found on DOMContentLoaded.");
    }
}); 