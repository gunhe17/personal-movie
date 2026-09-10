import { redirect } from '@sveltejs/kit'

// 일정 설정은 저장 핸들러 미연결 상태의 더미 화면.
// 평가 중 URL 직접접근 시 더미 노출을 막기 위해 캘린더로 리다이렉트.
export const load = () => {
  throw redirect(307, '/schedule/calendar')
}
