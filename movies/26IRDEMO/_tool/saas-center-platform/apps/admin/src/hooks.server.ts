import type { Handle } from '@sveltejs/kit'
import {
  isTokenExpired,
  extractUserFromToken,
  tryRefreshAndSetCookies
} from '$lib/server/auth'
import { COOKIE_CONFIG } from '$lib/server/config'

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null
  event.locals.accessToken = null

  const accessToken = event.cookies.get(COOKIE_CONFIG.accessToken.name)
  const refreshToken = event.cookies.get(COOKIE_CONFIG.refreshToken.name)

  if (accessToken && !isTokenExpired(accessToken)) {
    event.locals.user = extractUserFromToken(accessToken)
    event.locals.accessToken = accessToken
  } else if (refreshToken) {
    const isProduction = event.url.protocol === 'https:'
    const refreshed = await tryRefreshAndSetCookies(event.cookies, isProduction)

    if (refreshed) {
      const newAccessToken = event.cookies.get(COOKIE_CONFIG.accessToken.name)
      if (newAccessToken) {
        event.locals.user = extractUserFromToken(newAccessToken)
        event.locals.accessToken = newAccessToken
      }
    }
  }

  const response = await resolve(event)
  return response
}
