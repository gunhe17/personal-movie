import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ASSESSMENT_COOKIE_CONFIG } from '$lib/server/assessment-auth'

export const POST: RequestHandler = async ({ cookies, url }) => {
  const isProduction = url.protocol === 'https:'
  const deleteOptions = {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const
  }

  cookies.set(ASSESSMENT_COOKIE_CONFIG.accessToken.name, '', deleteOptions)
  cookies.set(ASSESSMENT_COOKIE_CONFIG.refreshToken.name, '', deleteOptions)

  cookies.set(ASSESSMENT_COOKIE_CONFIG.accessToken.name, '', {
    ...deleteOptions,
    httpOnly: false
  })
  cookies.set(ASSESSMENT_COOKIE_CONFIG.refreshToken.name, '', {
    ...deleteOptions,
    httpOnly: false
  })

  return json({
    success: true,
    message: '로그아웃되었습니다.'
  })
}
