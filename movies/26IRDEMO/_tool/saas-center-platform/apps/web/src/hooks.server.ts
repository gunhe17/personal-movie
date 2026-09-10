import type { Handle } from '@sveltejs/kit'
import {
  isTokenExpired,
  extractUserFromToken,
  tryRefreshAndSetCookies
} from '$lib/server/auth'

export const handle: Handle = async ({ event, resolve }) => {
  // 기본값 설정
  event.locals.user = null
  event.locals.accessToken = null

  // 공개 경로도 토큰은 읽어서 locals.user 설정 (로그인/센터선택 새로고침 시 복원용)
  // 인증 필수 여부는 (protected) 레이아웃에서만 판단
  const accessToken = event.cookies.get('accessToken')
  const refreshToken = event.cookies.get('refreshToken')

  console.log('[Hooks] Path:', event.url.pathname)
  console.log('[Hooks] accessToken exists:', !!accessToken)
  console.log('[Hooks] refreshToken exists:', !!refreshToken)

  if (accessToken && !isTokenExpired(accessToken)) {
    // 유효한 액세스 토큰이 있는 경우
    console.log('[Hooks] Access token valid, using it')
    event.locals.user = extractUserFromToken(accessToken)
    event.locals.accessToken = accessToken
  } else if (refreshToken) {
    // 액세스 토큰이 만료되었지만 리프레시 토큰이 있는 경우
    console.log('[Hooks] Access token invalid/missing, trying refresh...')
    const isProduction = event.url.protocol === 'https:'
    const refreshed = await tryRefreshAndSetCookies(event.cookies, isProduction)

    if (refreshed) {
      console.log('[Hooks] Refresh successful!')
      const newAccessToken = event.cookies.get('accessToken')
      if (newAccessToken) {
        event.locals.user = extractUserFromToken(newAccessToken)
        event.locals.accessToken = newAccessToken
      }
    } else {
      console.log('[Hooks] Refresh failed')
    }
  } else {
    console.log('[Hooks] No tokens available')
  }

  const response = await resolve(event)
  return response
}
