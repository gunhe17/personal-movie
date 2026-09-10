import { redirect } from '@sveltejs/kit'

// 검사 통계는 전체 하드코딩 더미(값 86 반복·유령 데이터)로 실연동 전 상태.
// nav 미링크 URL 직접접근 시 가짜 통계 노출을 막기 위해 검사 현황으로 리다이렉트.
export const load = () => {
  throw redirect(307, '/assessment/status')
}
