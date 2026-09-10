import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
  if (!locals.user) {
    const redirectTo = url.pathname + url.search
    throw redirect(302, `/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  }

  // 로그인→센터선택 후 protected로 클라이언트 네비게이션 시 root 레이아웃 로드는
  // 재실행되지 않아 user가 stale(null)일 수 있다. protected는 매 진입마다 새로 실행되므로
  // 여기서 fresh locals.user를 내려야 data.user가 채워진다(권한 로드·네비 렌더 의존).
  // 이름 보강은 root가 /auth/me로 처리하고 onMount 순서상 root가 마지막에 store를 덮는다.
  return { user: locals.user }
}
