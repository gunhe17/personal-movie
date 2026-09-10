import { redirect } from '@sveltejs/kit'
import { showAiFeatures } from '$lib/config/environment'
import type { LayoutLoad } from './$types'

// 필드노트 웹 열람은 리빙랩·개발만 노출 (D1 확정 2026-07-20) — [id] 하위까지 가드
export const load: LayoutLoad = ({ url }) => {
  if (!showAiFeatures(url.hostname)) redirect(302, '/')
}
