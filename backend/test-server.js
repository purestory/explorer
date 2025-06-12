const express = require('express');
const app = express();
const PORT = 3302;

console.log('서버 시작 중...');

app.get('/', (req, res) => {
  res.send('테스트 서버가 정상적으로 작동하고 있습니다!');
});

app.listen(PORT, () => {
  console.log(`테스트 서버가 ${PORT} 포트에서 실행 중입니다.`);
});

console.log('서버 설정 완료'); 