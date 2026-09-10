import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { API_URL } from '$lib/server/config'
import { setAssessmentAuthCookies } from '$lib/server/assessment-auth'

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  account: {
    id: string
    email: string
    is_verified: boolean
    created_at: string
  }
  person: {
    id: string
    name: string
    phone: string
  }
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  centers: Array<{
    id: string
    name: string
    code?: string
    logo_url?: string | null
    [key: string]: unknown
  }>
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  try {
    const body: LoginRequest = await request.json()

    const response = await fetch(`${API_URL}/auth/login`, {
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

    const data: LoginResponse = await response.json()
    const isProduction = url.protocol === 'https:'

    setAssessmentAuthCookies(
      cookies,
      data.access_token,
      data.refresh_token,
      isProduction,
      data.expires_in
    )

    let role = 'counselor'
    try {
      const payload = JSON.parse(
        Buffer.from(data.access_token.split('.')[1], 'base64').toString('utf-8')
      )
      if (payload.role) {
        role = payload.role
      }
    } catch {
      // role 추출 실패 시 기본값 사용
    }

    return json({
      success: true,
      user: {
        id: data.person.id,
        email: data.account.email,
        name: data.person.name,
        phone: data.person.phone,
        role,
        isVerified: data.account.is_verified,
        centers: data.centers
      }
    })
  } catch (error) {
    console.error('[Assessment Login] error:', error)
    return json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    )
  }
}
