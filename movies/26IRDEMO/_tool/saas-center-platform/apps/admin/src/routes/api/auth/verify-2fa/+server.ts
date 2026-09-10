import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { API_URL, COOKIE_CONFIG } from '$lib/server/config'

interface Verify2FARequest {
  pending_token: string
  code: string
}

interface AdminTokenResponse {
  admin_account: {
    id: string
    email: string
    name: string
    role: string
    is_active: boolean
    last_login_at: string | null
  }
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  must_change_password: boolean
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  try {
    const body: Verify2FARequest = await request.json()

    // Admin 2FA 검증 API 호출 (Step 2)
    const response = await fetch(`${API_URL}/admin/auth/verify-2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return json(
        {
          success: false,
          message: errorData.detail || errorData.message || '인증에 실패했습니다.'
        },
        { status: response.status }
      )
    }

    const data: AdminTokenResponse = await response.json()
    const isProduction = url.protocol === 'https:'

    // HTTP-Only 쿠키로 토큰 설정
    const accessMaxAge =
      data.expires_in > 0 ? data.expires_in : COOKIE_CONFIG.accessToken.maxAge

    cookies.set(COOKIE_CONFIG.accessToken.name, data.access_token, {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: accessMaxAge
    })

    cookies.set(COOKIE_CONFIG.refreshToken.name, data.refresh_token, {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: COOKIE_CONFIG.refreshToken.maxAge
    })

    // 클라이언트에게 사용자 정보 반환 (토큰 제외)
    return json({
      success: true,
      user: {
        id: data.admin_account.id,
        email: data.admin_account.email,
        name: data.admin_account.name,
        role: data.admin_account.role
      },
      must_change_password: data.must_change_password
    })
  } catch (error) {
    console.error('Admin 2FA verify error:', error)
    return json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
