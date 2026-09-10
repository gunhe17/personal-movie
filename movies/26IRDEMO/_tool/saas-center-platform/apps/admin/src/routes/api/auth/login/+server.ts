import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { API_URL, COOKIE_CONFIG } from '$lib/server/config'

interface AdminLoginResponse {
  requires_2fa: boolean
  pending_token?: string
  user: {
    email: string
    name: string
    role: string
  }
  // DEBUG 모드 전용 (2FA 스킵 시)
  admin_account?: {
    id: string
    email: string
    name: string
    role: string
    is_active: boolean
    last_login_at: string | null
  }
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  must_change_password?: boolean
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  try {
    const body = await request.json()

    const response = await fetch(`${API_URL}/admin/auth/login`, {
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
          message: errorData.detail || errorData.message || '로그인에 실패했습니다.'
        },
        { status: response.status }
      )
    }

    const data: AdminLoginResponse = await response.json()

    // DEBUG 모드: 2FA 스킵 → 바로 쿠키 설정 + 로그인 완료
    if (!data.requires_2fa && data.access_token && data.refresh_token) {
      const isProduction = url.protocol === 'https:'
      const accessMaxAge =
        data.expires_in && data.expires_in > 0 ? data.expires_in : COOKIE_CONFIG.accessToken.maxAge

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

      return json({
        success: true,
        requires_2fa: false,
        user: {
          id: data.admin_account!.id,
          email: data.admin_account!.email,
          name: data.admin_account!.name,
          role: data.admin_account!.role
        },
        must_change_password: data.must_change_password ?? false
      })
    }

    // 운영 모드: 2FA 필요 → pending_token 반환
    return json({
      success: true,
      requires_2fa: true,
      pending_token: data.pending_token,
      user: data.user
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
