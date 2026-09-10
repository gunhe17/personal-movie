import type { Cookies } from '@sveltejs/kit'
import { API_URL, COOKIE_CONFIG } from './config'
import type { UserInfo } from '../../app.d'

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8')
    return JSON.parse(payload)
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token)
  if (!payload || typeof payload.exp !== 'number') return true
  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

export function extractUserFromToken(token: string): UserInfo | null {
  const payload = decodeJwt(token)
  if (!payload) return null
  return {
    id: (payload.sub as string) || '',
    email: (payload.email as string) || '',
    name: (payload.name as string) || '',
    role: (payload.role as 'admin' | 'clinician' | 'researcher') || 'clinician'
  }
}

function getCookieOptions(isProduction: boolean, maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge
  }
}

type NewTokens = {
  accessToken: string
  refreshToken: string
  expiresIn?: number
}

async function callRefreshEndpoint(refreshToken: string): Promise<NewTokens | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    })

    if (!response.ok) return null

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in
    }
  } catch {
    return null
  }
}

// 동일한 raw refresh token에 대해 동시 다발적인 refresh 호출이 들어오면
// 첫 요청만 백엔드로 가고 나머지는 같은 결과를 공유한다.
// 백엔드는 RT 회전 시 기존 RT를 즉시 폐기하므로, 직렬화하지 않으면
// 두 번째 이후 호출이 401을 받아 race로 로그아웃되는 사고가 난다.
const REFRESH_RESULT_TTL_MS = 5_000
const inflightRefresh = new Map<string, Promise<NewTokens | null>>()
const recentRefresh = new Map<string, { at: number; result: NewTokens | null }>()

async function refreshAccessToken(
  refreshToken: string
): Promise<NewTokens | null> {
  const cached = recentRefresh.get(refreshToken)
  if (cached && Date.now() - cached.at < REFRESH_RESULT_TTL_MS) {
    return cached.result
  }

  const existing = inflightRefresh.get(refreshToken)
  if (existing) return existing

  const promise = callRefreshEndpoint(refreshToken)
    .then((result) => {
      recentRefresh.set(refreshToken, { at: Date.now(), result })
      const t = setTimeout(
        () => recentRefresh.delete(refreshToken),
        REFRESH_RESULT_TTL_MS
      )
      ;(t as unknown as { unref?: () => void }).unref?.()
      return result
    })
    .finally(() => {
      inflightRefresh.delete(refreshToken)
    })

  inflightRefresh.set(refreshToken, promise)
  return promise
}

export async function tryRefreshAndSetCookies(
  cookies: Cookies,
  isProduction: boolean
): Promise<boolean> {
  const refreshToken = cookies.get(COOKIE_CONFIG.refreshToken.name)
  if (!refreshToken) {
    clearAuthCookies(cookies)
    return false
  }

  const isJwtFormat = refreshToken.split('.').length === 3
  if (isJwtFormat && isTokenExpired(refreshToken)) {
    clearAuthCookies(cookies)
    return false
  }

  const newTokens = await refreshAccessToken(refreshToken)
  if (!newTokens) {
    // 일시적 실패(race, 네트워크 등)는 쿠키를 보존하고 false만 반환한다.
    // 다음 요청에서 재시도되며, 진짜로 RT가 만료된 경우는 다음 호출이 같은 경로로
    // 다시 401을 받아 자연스럽게 로그아웃 처리된다.
    return false
  }

  const accessMaxAge =
    newTokens.expiresIn && newTokens.expiresIn > 0
      ? newTokens.expiresIn
      : COOKIE_CONFIG.accessToken.maxAge

  cookies.set(
    COOKIE_CONFIG.accessToken.name,
    newTokens.accessToken,
    getCookieOptions(isProduction, accessMaxAge)
  )

  if (newTokens.refreshToken !== refreshToken) {
    cookies.set(
      COOKIE_CONFIG.refreshToken.name,
      newTokens.refreshToken,
      getCookieOptions(isProduction, COOKIE_CONFIG.refreshToken.maxAge)
    )
  }

  return true
}

export function clearAuthCookies(cookies: Cookies): void {
  cookies.delete(COOKIE_CONFIG.accessToken.name, { path: '/' })
  cookies.delete(COOKIE_CONFIG.refreshToken.name, { path: '/' })
  cookies.delete(COOKIE_CONFIG.institution.name, { path: '/' })
}

export function setInstitutionCookie(
  cookies: Cookies,
  institutionId: string,
  isProduction: boolean
): void {
  cookies.set(
    COOKIE_CONFIG.institution.name,
    institutionId,
    getCookieOptions(isProduction, COOKIE_CONFIG.institution.maxAge)
  )
}

export function setAuthCookies(
  cookies: Cookies,
  accessToken: string,
  refreshToken: string,
  isProduction: boolean,
  accessExpiresIn?: number
): void {
  const accessMaxAge =
    accessExpiresIn && accessExpiresIn > 0
      ? accessExpiresIn
      : COOKIE_CONFIG.accessToken.maxAge

  cookies.set(
    COOKIE_CONFIG.accessToken.name,
    accessToken,
    getCookieOptions(isProduction, accessMaxAge)
  )

  cookies.set(
    COOKIE_CONFIG.refreshToken.name,
    refreshToken,
    getCookieOptions(isProduction, COOKIE_CONFIG.refreshToken.maxAge)
  )
}
