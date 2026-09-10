import type { Cookies } from '@sveltejs/kit'
import { API_URL, COOKIE_CONFIG } from './config'
import type { AdminUser, AdminRole } from '../../app.d'

export function decodeJwt(
  token: string
): Record<string, unknown> | null {
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

export function extractUserFromToken(token: string): AdminUser | null {
  const payload = decodeJwt(token)
  if (!payload) return null

  // admin 토큰인지 확인 (센터 토큰 혼용 방지)
  if (payload.token_type !== 'admin') return null

  return {
    id: (payload.admin_account_id as string) || '',
    email: (payload.email as string) || '',
    name: (payload.name as string) || '',
    role: ((payload.role as string) || 'admin') as AdminRole
  }
}

export function getCookieOptions(isProduction: boolean, maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn?: number
} | null> {
  try {
    const response = await fetch(`${API_URL}/admin/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    })

    if (!response.ok) return null

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: refreshToken,
      expiresIn: data.expires_in
    }
  } catch {
    return null
  }
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
    clearAuthCookies(cookies)
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
