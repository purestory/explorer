const express = require('express');
const explorer = require('webdav-server').v2;
const fs = require('fs');
// ... existing code ... 

// explorer 서버 설정
const server = new explorer.WebDAVServer({
  httpAuthentication: new explorer.HTTPBasicAuthentication(
    async (username, password) => {
      // 간단한 사용자 인증 (실제 서비스에서는 보안을 강화해야 함)
      return username === 'admin' && password === 'admin';
    }
  )
});

// explorer 파일시스템 설정
const fileSystem = new explorer.PhysicalFileSystem(ROOT_DIRECTORY);
// ... existing code ... 