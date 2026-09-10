import type { PageServerLoad } from './$types'
import { COOKIE_CONFIG } from '$lib/server/config'

/**
 * 검사 로그인 페이지: 같은 기기에서 일반 로그인이 되어 있는지 여부만 확인.
 * (일반/검사 로그인은 쿠키가 분리되어 있어, 검사 플로우에서는 별도 로그인이 필요함)
 */
export const load: PageServerLoad = async ({ cookies }) => {
  const hasMainSession = !!cookies.get(COOKIE_CONFIG.accessToken.name)
  return { hasMainSession }
}
