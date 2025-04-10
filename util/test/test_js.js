// 테스트용 JavaScript 파일
// 여러 이벤트 리스너 및 3번째 인자 테스트

// 기본적인 이벤트 리스너 (인자 없음)
document.addEventListener('click', handleClick);

// 익명 함수를 사용한 이벤트 리스너
element.addEventListener('mousedown', function(e) {
  console.log('마우스 다운 이벤트 발생');
});

// 화살표 함수를 사용한 이벤트 리스너
window.addEventListener('resize', (e) => {
  console.log('창 크기 조정됨');
});

// 3번째 인자로 boolean 값이 있는 경우
document.addEventListener('focus', handleFocus, true);

// 3번째 인자로 객체가 있는 경우
button.addEventListener('click', handleButtonClick, { 
  once: true,
  passive: false,
  capture: true 
});

// 3번째 인자로 여러 줄에 걸친 객체가 있는 경우
element.addEventListener('scroll', handleScroll, {
  passive: true,
  once: false,
  capture: false,
  signal: controller.signal
});

// 중첩된 코드 내부에 3번째 인자가 있는 경우
function setupListeners() {
  const options = { passive: true };
  document.body.addEventListener('touchstart', handleTouchStart, options);
}

// addEventListener 뒤에 다른 코드가 있는 경우
element.addEventListener('keydown', handleKeyDown, { capture: true }); console.log('리스너 등록됨');

// 여러 줄에 걸친 3번째 인자
document.addEventListener('click', () => {
  alert('클릭됨');
}, {
  capture: true,
  once: true,
  passive: false
});

// 다른 형태로 여러 줄에 걸친 3번째 인자
document.addEventListener(
  'submit', 
  handleSubmit,
  {
    once: true,
    passive: false
  }
); 