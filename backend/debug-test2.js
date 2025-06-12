const path = require('path');
const fs = require('fs');

// .env 로드
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

console.log('=== 디렉토리 초기화 테스트 ===');

// 디렉토리 경로 설정
const LOGS_DIRECTORY = path.join(__dirname, 'logs');
const ROOT_DIRECTORY = path.join(__dirname, 'share-folder');
const TMP_UPLOAD_DIR = path.join(__dirname, 'tmp');

console.log('LOGS_DIRECTORY:', LOGS_DIRECTORY);
console.log('ROOT_DIRECTORY:', ROOT_DIRECTORY);
console.log('TMP_UPLOAD_DIR:', TMP_UPLOAD_DIR);

// 디렉토리 존재 확인
async function testDirectories() {
  try {
    console.log('=== 로그 디렉토리 확인 ===');
    try {
      await fs.promises.access(LOGS_DIRECTORY);
      console.log('로그 디렉토리 존재:', LOGS_DIRECTORY);
    } catch (error) {
      console.log('로그 디렉토리 없음, 생성 시도:', error.code);
      if (error.code === 'ENOENT') {
        await fs.promises.mkdir(LOGS_DIRECTORY, { recursive: true });
        console.log('로그 디렉토리 생성 완료');
      }
    }

    console.log('=== 루트 디렉토리 확인 ===');
    try {
      await fs.promises.access(ROOT_DIRECTORY);
      console.log('루트 디렉토리 존재:', ROOT_DIRECTORY);
    } catch (error) {
      console.log('루트 디렉토리 없음, 생성 시도:', error.code);
      if (error.code === 'ENOENT') {
        await fs.promises.mkdir(ROOT_DIRECTORY, { recursive: true });
        console.log('루트 디렉토리 생성 완료');
      }
    }

    console.log('=== 권한 설정 테스트 ===');
    await fs.promises.chmod(ROOT_DIRECTORY, 0o777);
    console.log('루트 디렉토리 권한 설정 완료');

    console.log('=== 임시 디렉토리 확인 ===');
    try {
      await fs.promises.access(TMP_UPLOAD_DIR);
      console.log('임시 디렉토리 존재:', TMP_UPLOAD_DIR);
    } catch (error) {
      console.log('임시 디렉토리 없음, 생성 시도:', error.code);
      if (error.code === 'ENOENT') {
        await fs.promises.mkdir(TMP_UPLOAD_DIR, { recursive: true });
        console.log('임시 디렉토리 생성 완료');
      }
    }

    console.log('=== 모든 디렉토리 초기화 완료 ===');

  } catch (error) {
    console.error('디렉토리 초기화 중 에러:', error);
    console.error('스택 트레이스:', error.stack);
  }
}

testDirectories(); 