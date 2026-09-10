import { json, type RequestEvent } from '@sveltejs/kit'
import { setInstitutionCookie } from '$lib/server/auth'
import { COOKIE_CONFIG, resolveApiUrl } from '$lib/server/config'

/**
 * 기관 전환 — institution_id httpOnly cookie 발급.
 *
 * 멤버십 검증은 백엔드 `/institutions/{id}` 조회 시 발생하는 권한 검증
 * (get_institution_context)를 통과하는지로 확인. 200이면 set-cookie.
 */
export async function POST(event: RequestEvent) {
  const { institution_id } = await event.request.json()
  if (!institution_id || typeof institution_id !== 'string') {
    return json(
      { success: false, message: 'institution_id required' },
      { status: 400 }
    )
  }

  const accessToken = event.cookies.get(COOKIE_CONFIG.accessToken.name)
  if (!accessToken) {
    return json(
      { success: false, message: 'Unauthenticated' },
      { status: 401 }
    )
  }

  // 백엔드에 멤버십 검증 — institution 단건 조회 시 get_institution_context가 검증
  const verifyRes = await fetch(resolveApiUrl(`institutions/${institution_id}`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // 임시 cookie 헤더 — 백엔드 검증 통과를 위해 path와 동일한 값으로 set
      Cookie: `${COOKIE_CONFIG.institution.name}=${institution_id}`
    }
  })

  if (!verifyRes.ok) {
    return json(
      { success: false, message: '해당 기관에 접근 권한이 없습니다.' },
      { status: verifyRes.status }
    )
  }

  const isProduction = event.url.protocol === 'https:'
  setInstitutionCookie(event.cookies, institution_id, isProduction)

  return json({ success: true })
}
