import { dev } from '$app/environment'
import { redirect } from '@sveltejs/kit'

// 실험(랩) 페이지 — 리빙랩 평가자 오접근 방지, 개발 환경 전용
export const load = () => {
  if (!dev) redirect(307, '/dashboard')
}
