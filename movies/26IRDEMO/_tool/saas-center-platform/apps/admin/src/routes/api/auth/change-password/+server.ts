import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { API_URL, COOKIE_CONFIG } from '$lib/server/config'

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json()
    const accessToken = cookies.get(COOKIE_CONFIG.accessToken.name)

    if (!accessToken) {
      return json({ success: false, message: '인증이 필요합니다.' }, { status: 401 })
    }

    const response = await fetch(`${API_URL}/admin/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      let message = '비밀번호 변경에 실패했습니다.'
      if (Array.isArray(data.detail)) {
        message = data.detail[0]?.msg?.replace('Value error, ', '') || message
      } else if (typeof data.detail === 'string') {
        message = data.detail
      } else if (data.message) {
        message = data.message
      }
      return json({ success: false, message }, { status: response.status })
    }

    return json({ success: true, message: data.message || '비밀번호가 변경되었습니다.' })
  } catch (error) {
    console.error('Change password error:', error)
    return json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
