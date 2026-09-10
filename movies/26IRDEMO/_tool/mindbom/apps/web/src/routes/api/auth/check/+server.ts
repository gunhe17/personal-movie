import { json, type RequestEvent } from '@sveltejs/kit'
import { COOKIE_CONFIG } from '$lib/server/config'
import { extractUserFromToken, isTokenExpired, tryRefreshAndSetCookies } from '$lib/server/auth'

export async function GET(event: RequestEvent) {
  const accessToken = event.cookies.get(COOKIE_CONFIG.accessToken.name)
  const institutionId = event.cookies.get(COOKIE_CONFIG.institution.name) ?? null
  const isProduction = event.url.protocol === 'https:'

  // 1. accessToken이 유효하면 바로 반환
  if (accessToken && !isTokenExpired(accessToken)) {
    const user = extractUserFromToken(accessToken)
    if (user) {
      return json({
        authenticated: true,
        user,
        currentInstitutionId: institutionId
      })
    }
  }

  // 2. refreshToken으로 갱신 시도
  const refreshed = await tryRefreshAndSetCookies(event.cookies, isProduction)
  if (refreshed) {
    const newAccessToken = event.cookies.get(COOKIE_CONFIG.accessToken.name)
    if (newAccessToken) {
      const user = extractUserFromToken(newAccessToken)
      if (user) {
        return json({
          authenticated: true,
          user,
          currentInstitutionId: institutionId
        })
      }
    }
  }

  return json(
    { authenticated: false, user: null, currentInstitutionId: null },
    { status: 401 }
  )
}
