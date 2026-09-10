import { redirect } from '@sveltejs/kit'

// 설정 인덱스는 실동작 없는 더미 화면이었음(토글 저장 안 됨).
// 실제 설정 서브페이지로 리다이렉트해 리빙랩 평가 중 가짜 화면 노출을 막는다.
export const load = () => {
  throw redirect(307, '/settings/account-info')
}
