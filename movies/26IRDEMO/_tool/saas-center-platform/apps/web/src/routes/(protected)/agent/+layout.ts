import { redirect } from '@sveltejs/kit'
import { showAiFeatures } from '$lib/config/environment'
import type { LayoutLoad } from './$types'

// AI 에이전트는 운영 미배포 (D1: 리빙랩·개발만 노출) — 메뉴 숨김 = 라우트 가드
export const load: LayoutLoad = ({ url }) => {
  if (!showAiFeatures(url.hostname)) redirect(302, '/')
}
