import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'
export const load: LayoutServerLoad = async ({ url, locals }) => {
  // 호환 리다이렉트 페이지는 예외 처리
  if (url.pathname.startsWith('/assessment/login')) {
    return {}
  }

  // /assessment/* 는 내부 운영자 흐름으로 고정
  if (!locals.user) {
    const redirectTo = url.pathname + url.search
    throw redirect(302, `/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  }
  return {}
}
