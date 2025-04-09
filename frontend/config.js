// Configuration values

// URL 경로에 따라 적절한 API 베이스 URL 설정
export const API_BASE_URL = window.location.hostname === 'itsmyzone.iptime.org' ? 
    window.location.origin : window.location.origin; 