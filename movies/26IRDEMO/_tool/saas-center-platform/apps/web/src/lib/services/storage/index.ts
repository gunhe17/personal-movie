const getLocalStorage = (key: string) => {
  const value = localStorage.getItem(key)
  if (!value) return null
  return JSON.parse(value)
}

const setLocalStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value))
}

const removeLocalStorage = (key: string) => {
  localStorage.removeItem(key)
}

const clearLocalStorage = () => {
  localStorage.clear()
}

const getSessionStorage = (key: string) => {
  const value = sessionStorage.getItem(key)
  if (!value) return null
  return JSON.parse(value)
}

const setSessionStorage = (key: string, value: any) => {
  sessionStorage.setItem(key, JSON.stringify(value))
}

const removeSessionStorage = (key: string) => {
  sessionStorage.removeItem(key)
}

const clearSessionStorage = () => {
  sessionStorage.clear()
}

const setCookie = (name: string, value: string, days = 7) => {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`
}

// 보안 강화된 쿠키 설정 (토큰용) - httpOnly 없이
const setSecureCookie = (name: string, value: string, days = 7) => {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)

  // 보안 옵션 설정 (httpOnly 제외)
  const secure = window.location.protocol === 'https:' ? ';secure' : ''
  const sameSite = ';samesite=strict'

  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/${secure}${sameSite}`
}

// Access Token용 쿠키 (단기, 높은 보안)
const setAccessTokenCookie = (value: string, days = 1) => {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)

  const secure = window.location.protocol === 'https:' ? ';secure' : ''
  const sameSite = ';samesite=strict'

  document.cookie = `accessToken=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/${secure}${sameSite}`
}

// Refresh Token용 쿠키 (장기, 중간 보안)
const setRefreshTokenCookie = (value: string, days = 30) => {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)

  const secure = window.location.protocol === 'https:' ? ';secure' : ''
  const sameSite = ';samesite=lax' // CSRF 방지를 위해 lax 사용

  document.cookie = `refreshToken=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/${secure}${sameSite}`
}

const getCookie = (name: string): string | undefined => {
  const nameEQ = name + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim()
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length))
    }
  }
  return undefined
}

const removeCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`
}

export {
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  clearLocalStorage,
  getSessionStorage,
  setSessionStorage,
  removeSessionStorage,
  clearSessionStorage,
  setCookie,
  setSecureCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  getCookie,
  removeCookie
}
