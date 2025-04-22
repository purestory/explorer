const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const submitButton = loginForm.querySelector('button[type="submit"]'); // 버튼 요소 가져오기

// !!! 보안 경고 !!!
// 이 비밀번호는 클라이언트 측 코드에 노출되어 매우 안전하지 않습니다.
// 단순한 접근 제한 용도로만 사용해야 하며, 실제 보안이 필요한 시스템에는
// 반드시 서버 측 인증을 구현해야 합니다.
// const CORRECT_PASSWORD = "replace_with_your_actual_password"; // <-- 실제 사용할 비밀번호로 변경하세요

loginForm.addEventListener('submit', async (event) => { // async 추가
    event.preventDefault(); // 기본 제출 동작 방지
    errorMessage.textContent = ''; // 이전 오류 메시지 지우기
    submitButton.disabled = true; // 요청 중 버튼 비활성화
    submitButton.textContent = '확인 중...'; // 버튼 텍스트 변경

    const enteredPassword = passwordInput.value;

    try {
        // 서버 API 호출
        const response = await fetch('/explorer-api/verify-access', { // Netlify 프록시 사용
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: enteredPassword })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // 성공 시 메인 페이지로 이동
            window.location.href = "main.html"; 
        } else {
            // 실패 시 오류 메시지 표시
            errorMessage.textContent = data.message || '접근 코드가 유효하지 않습니다.';
            passwordInput.value = ''; // 입력 필드 초기화
            passwordInput.focus(); // 다시 입력하도록 포커스
        }
    } catch (error) {
        // 네트워크 오류 등 예외 처리
        console.error('Login API call failed:', error);
        errorMessage.textContent = '로그인 처리 중 오류가 발생했습니다. 네트워크 상태를 확인하세요.';
    } finally {
        // 요청 완료 후 버튼 활성화 및 텍스트 복원
        submitButton.disabled = false;
        submitButton.textContent = '접속 승인';
    }
}); 