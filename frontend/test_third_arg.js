// 1. 단일 라인 (3번째 인자가 boolean)
document.addEventListener('focus', handleFocus, true);

// 2. 단일 라인 (3번째 인자가 객체)
element.addEventListener('click', handleClick, { capture: true });

// 3. 여러 줄에 걸친 3번째 인자
document.addEventListener('scroll', handleScroll, {
  passive: true,
  once: true
}); 