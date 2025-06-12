// DOM 요소들
const accessBtn = document.getElementById('accessBtn');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const submitButton = loginForm.querySelector('button[type="submit"]');

// 이용규칙 관련 요소들
const rulesBtn = document.getElementById('rulesBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');
const rulesContent = document.getElementById('rulesContent');

// 접속 버튼 클릭 시 모달 열기
accessBtn.addEventListener('click', () => {
    loginModal.style.display = 'flex';
    passwordInput.focus();
});

// 모달 외부 클릭 시 닫기
loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        loginModal.style.display = 'none';
        errorMessage.textContent = '';
        passwordInput.value = '';
    }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        loginModal.style.display = 'none';
        rulesModal.style.display = 'none';
        errorMessage.textContent = '';
        passwordInput.value = '';
    }
});

// 로그인 폼 제출 처리
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = '확인 중...';

    const enteredPassword = passwordInput.value;

    try {
        const response = await fetch('/explorer-api/verify-access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: enteredPassword })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // 성공 시 메인 페이지로 이동
            window.location.href = "main";
        } else {
            // 실패 시 오류 메시지 표시
            errorMessage.textContent = data.message || '접근 코드가 유효하지 않습니다.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (error) {
        console.error('Login API call failed:', error);
        errorMessage.textContent = '로그인 처리 중 오류가 발생했습니다. 네트워크 상태를 확인하세요.';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '접속 승인';
    }
});

// 이용규칙 모달 처리
rulesBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/explorer/rules/rules.md');
        if (response.ok) {
            const rulesText = await response.text();
            rulesContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit; line-height: 1.6;">${rulesText}</pre>`;
        } else {
            rulesContent.innerHTML = '<p>이용규칙을 불러올 수 없습니다.</p>';
        }
    } catch (error) {
        rulesContent.innerHTML = '<p>이용규칙을 불러오는 중 오류가 발생했습니다.</p>';
    }
    rulesModal.style.display = 'block';
});

closeRulesBtn.addEventListener('click', () => {
    rulesModal.style.display = 'none';
});

// 모달 닫기 버튼들
document.querySelectorAll('.modal-close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
    });
});

// 모달 외부 클릭으로 닫기
rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
        rulesModal.style.display = 'none';
    }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 시스템 리소스 정보는 숨김 (로그인 전)
    const systemResources = document.getElementById('systemResources');
    if (systemResources) {
        systemResources.style.display = 'none';
    }
    
    // 서버 상태 표시
    const serverStatusText = document.getElementById('serverStatusText');
    const serverStatusIcon = document.getElementById('serverStatusIcon');
    if (serverStatusText && serverStatusIcon) {
        serverStatusIcon.innerHTML = '<i class="fas fa-circle" style="color: #28a745;"></i>';
        serverStatusText.textContent = '서버 연결됨';
    }
}); 