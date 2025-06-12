const express = require('express');
const app = express();
const PORT = 3303;

console.log('간단한 서버 시작...');

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ message: '서버가 정상적으로 작동하고 있습니다!' });
});

// 에러 핸들러
app.use((error, req, res, next) => {
  console.error('에러 발생:', error);
  res.status(500).json({ error: '서버 에러' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`간단한 서버가 ${PORT} 포트에서 실행 중입니다.`);
});

// 프로세스 종료 방지
process.on('SIGINT', () => {
  console.log('SIGINT 신호 받음, 서버 종료 중...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM 신호 받음, 서버 종료 중...');
  process.exit(0);
});

console.log('서버 설정 완료!'); 