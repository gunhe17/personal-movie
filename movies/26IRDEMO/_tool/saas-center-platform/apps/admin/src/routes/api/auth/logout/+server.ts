import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { COOKIE_CONFIG } from '$lib/server/config'

export const POST: RequestHandler = async ({ cookies, url }) => {
  const isProduction = url.protocol === 'https:'

  const deleteOptions = {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const
  }

  cookies.set(COOKIE_CONFIG.accessToken.name, '', deleteOptions)
  cookies.set(COOKIE_CONFIG.refreshToken.name, '', deleteOptions)

  return json({
    success: true,
    message: '로그아웃되었습니다.'
  })
}
