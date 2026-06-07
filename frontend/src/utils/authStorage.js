const AUTH_KEYS = ['accessToken', 'refreshToken', 'userInfo']
const REMEMBER_ME_KEY = 'rememberMe'

export function getRememberMePreference() {
  const saved = localStorage.getItem(REMEMBER_ME_KEY)
  if (saved === null) return true
  return saved === 'true'
}

export function setRememberMePreference(value) {
  localStorage.setItem(REMEMBER_ME_KEY, String(value))
}

function getActiveStorage() {
  return localStorage.getItem('accessToken') ? localStorage : sessionStorage
}

export function getAccessToken() {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
}

export function getRefreshToken() {
  return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')
}

export function getUserInfo() {
  return localStorage.getItem('userInfo') || sessionStorage.getItem('userInfo')
}

export function saveAuthData({ accessToken, refreshToken, user }, rememberMe) {
  clearAuthData()
  const storage = rememberMe ? localStorage : sessionStorage
  storage.setItem('accessToken', accessToken)
  storage.setItem('refreshToken', refreshToken)
  if (user) storage.setItem('userInfo', JSON.stringify(user))
  setRememberMePreference(rememberMe)
}

export function updateAccessToken(accessToken, user) {
  const storage = getActiveStorage()
  storage.setItem('accessToken', accessToken)
  if (user) storage.setItem('userInfo', JSON.stringify(user))
}

export function clearAuthData() {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  }
}
