import { dev } from '$app/environment'
import { redirect } from '@sveltejs/kit'

// 컴포넌트 갤러리 — 개발 환경 전용, 리빙랩 오접근 방지
export const load = () => {
  if (!dev) redirect(307, '/login')
}
