try {
  console.log('1. dotenv 로드 시작');
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
  console.log('2. dotenv 로드 완료');
  
  console.log('3. express 로드 시작');
  const express = require('express');
  console.log('4. express 로드 완료');
  
  console.log('5. 앱 생성 시작');
  const app = express();
  console.log('6. 앱 생성 완료');
  
  console.log('7. 포트 설정:', process.env.PORT || 3301);
  
  console.log('8. fs 모듈 로드 시작');
  const fs = require('fs');
  console.log('9. fs 모듈 로드 완료');
  
  console.log('10. path 모듈 로드 시작');
  const path = require('path');
  console.log('11. path 모듈 로드 완료');
  
  console.log('12. 모든 기본 모듈 로드 성공');
  
} catch (error) {
  console.error('에러 발생:', error);
  console.error('스택 트레이스:', error.stack);
} 