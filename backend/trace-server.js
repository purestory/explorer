const originalExit = process.exit;
process.exit = function(code) {
  console.log('프로세스 종료 시도:', code);
  console.trace('종료 호출 스택:');
  originalExit.call(process, code);
};

// 처리되지 않은 예외 캐치
process.on('uncaughtException', (error) => {
  console.error('처리되지 않은 예외:', error);
  console.error('스택 트레이스:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason);
  console.error('Promise:', promise);
});

console.log('서버 추적 모드로 시작...');

try {
  require('./server.js');
} catch (error) {
  console.error('서버 로딩 중 에러:', error);
  console.error('스택 트레이스:', error.stack);
} 