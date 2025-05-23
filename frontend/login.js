const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const submitButton = loginForm.querySelector('button[type="submit"]'); // 버튼 요소 가져오기


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
            // 성공 시 메인 페이지 라우트로 이동 (상대 경로)
            window.location.href = "main"; // 경로 수정: /main -> main (상대 경로)
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