const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // Локальная разработка через vite dev server
    // Vite proxy настроен на /api -> localhost:3000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Используем proxy через vite (работает и для dev и для production через nginx)
      return '/api';
    }
    
    // На сервере или любом другом хосте используем proxy через nginx
    return '/api';
  }
  
  // SSR fallback
  return '/api';
};

export const API_URL = getApiUrl()

export const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken')
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  }
}

/** Проверяет, истёк ли access token (с запасом 60 сек) */
export function isAccessTokenExpired(token) {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (typeof payload.exp !== 'number') return true
    return payload.exp * 1000 < Date.now() + 60000
  } catch {
    return true
  }
}
