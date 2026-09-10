import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'
import {
  ASSESSMENT_COOKIE_CONFIG,
  isTokenExpired,
  tryRefreshAndSetAssessmentCookies
} from '$lib/server/assessment-auth'

export const load: LayoutServerLoad = async ({ cookies, url }) => {
  if (url.pathname.startsWith('/assessment-flow/login')) {
    return {}
  }

  const accessToken = cookies.get(ASSESSMENT_COOKIE_CONFIG.accessToken.name)
  if (accessToken && !isTokenExpired(accessToken)) {
    return {}
  }

  const refreshToken = cookies.get(ASSESSMENT_COOKIE_CONFIG.refreshToken.name)
  if (refreshToken) {
    const isProduction = url.protocol === 'https:'
    const refreshed = await tryRefreshAndSetAssessmentCookies(
      cookies,
      isProduction
    )
    if (refreshed) {
      return {}
    }
  }

  const redirectTo = url.pathname + url.search
  throw redirect(
    302,
    `/assessment-flow/login?redirectTo=${encodeURIComponent(redirectTo)}`
  )
}
