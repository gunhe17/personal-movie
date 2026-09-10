import type { Cookies } from '@sveltejs/kit'
import { API_URL } from '$lib/server/config'

export const ASSESSMENT_COOKIE_CONFIG = {
  accessToken: {
    name: 'assessmentAccessToken',
    maxAge: 60 * 60 * 24
  },
  refreshToken: {
    name: 'assessmentRefreshToken',
    maxAge: 60 * 60 * 24 * 7
  }
} as const

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

function getCookieOptions(isProduction: boolean, maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge
  }
}

export function clearAssessmentAuthCookies(cookies: Cookies): void {
  cookies.delete(ASSESSMENT_COOKIE_CONFIG.accessToken.name, { path: '/' })
  cookies.delete(ASSESSMENT_COOKIE_CONFIG.refreshToken.name, { path: '/' })
}

export function setAssessmentAuthCookies(
  cookies: Cookies,
  accessToken: string,
  refreshToken: string,
  isProduction: boolean,
  accessExpiresIn?: number
): void {
  const accessMaxAge = accessExpiresIn && accessExpiresIn > 0
    ? accessExpiresIn
    : ASSESSMENT_COOKIE_CONFIG.accessToken.maxAge

  cookies.set(
    ASSESSMENT_COOKIE_CONFIG.accessToken.name,
    accessToken,
    getCookieOptions(isProduction, accessMaxAge)
  )

  cookies.set(
    ASSESSMENT_COOKIE_CONFIG.refreshToken.name,
    refreshToken,
    getCookieOptions(
      isProduction,
      ASSESSMENT_COOKIE_CONFIG.refreshToken.maxAge
    )
  )
}

async function refreshAssessmentAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn?: number
} | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    })

    if (!response.ok) {
      return null
    }

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

export async function tryRefreshAndSetAssessmentCookies(
  cookies: Cookies,
  isProduction: boolean
): Promise<boolean> {
  const refreshToken = cookies.get(ASSESSMENT_COOKIE_CONFIG.refreshToken.name)
  if (!refreshToken) {
    clearAssessmentAuthCookies(cookies)
    return false
  }

  const isJwtFormat = refreshToken.split('.').length === 3
  if (isJwtFormat && isTokenExpired(refreshToken)) {
    clearAssessmentAuthCookies(cookies)
    return false
  }

  const newTokens = await refreshAssessmentAccessToken(refreshToken)
  if (!newTokens) {
    clearAssessmentAuthCookies(cookies)
    return false
  }

  setAssessmentAuthCookies(
    cookies,
    newTokens.accessToken,
    newTokens.refreshToken,
    isProduction,
    newTokens.expiresIn
  )

  return true
}
