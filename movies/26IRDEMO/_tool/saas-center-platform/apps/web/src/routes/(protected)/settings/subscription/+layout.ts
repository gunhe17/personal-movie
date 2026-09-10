import { redirect } from '@sveltejs/kit'
import { showSubscription } from '$lib/config/environment'

// 구독은 리빙랩·운영에서 숨김 (D5 확정 2026-07-20) — 메뉴 숨김 = 라우트 가드
export const load = ({ url }: { url: URL }) => {
  if (!showSubscription(url.hostname)) redirect(307, '/dashboard')
}
