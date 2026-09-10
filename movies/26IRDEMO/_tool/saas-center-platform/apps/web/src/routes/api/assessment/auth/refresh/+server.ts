import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import {
  ASSESSMENT_COOKIE_CONFIG,
  clearAssessmentAuthCookies,
  setAssessmentAuthCookies
} from '$lib/server/assessment-auth'
import { API_URL } from '$lib/server/config'

export const POST: RequestHandler = async ({ cookies, url }) => {
  const refreshToken = cookies.get(ASSESSMENT_COOKIE_CONFIG.refreshToken.name)

  if (!refreshToken) {
    return json(
      {
        success: false,
        message: '리프레시 토큰이 없습니다.'
      },
      { status: 401 }
    )
  }

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
      clearAssessmentAuthCookies(cookies)
      return json(
        {
          success: false,
          message: '세션이 만료되었습니다. 다시 로그인해주세요.'
        },
        { status: 401 }
      )
    }

    const data = await response.json()
    const isProduction = url.protocol === 'https:'

    setAssessmentAuthCookies(
      cookies,
      data.access_token,
      data.refresh_token || refreshToken,
      isProduction,
      data.expires_in
    )

    return json({
      success: true,
      message: '토큰이 갱신되었습니다.'
    })
  } catch (error) {
    console.error('[Assessment Refresh] error:', error)
    return json(
      {
        success: false,
        message: '토큰 갱신 중 오류가 발생했습니다.'
      },
      { status: 500 }
    )
  }
}
