// 백엔드 comprehensive_report/constants.py 와 미러링

// 종합보고서에 선택 가능한 **검사(examination)** 상태 — 임상가 확정 이후.
// 재료가 되는 검사의 상태이지 종합보고서 자신의 상태가 아니다.
export const SELECTABLE_STATUSES = new Set([
  'confirmed',
  'report_generated',
  'completed',
])

// 종합보고서 **자신의** 상태가 확정 이후인가 — PDF 내보내기의 전제.
// 검사와 값이 우연히 겹치지만 별개다(이쪽엔 draft·ai_generated가 있다).
// 호출부에서 배열을 다시 적지 않는다 — 그렇게 하다 completed를 빠뜨려
// 가장 끝난 건만 기능이 막히는 회귀가 검사 쪽에서 있었다.
const REPORT_CONFIRMED_STATUSES = new Set([
  'confirmed',
  'report_generated',
  'completed',
])

/** 확정 이후 — 결과 열람·내보내기 가능 */
export function isReportConfirmed(status: string): boolean {
  return REPORT_CONFIRMED_STATUSES.has(status)
}

/** 보고서가 발행된 뒤 — 더 이상 편집 대상이 아니다 */
export function isReportFinalized(status: string): boolean {
  return status === 'report_generated' || status === 'completed'
}

// 검사 타입 라벨은 examination/common/exam-visual.ts의 examTypeLabel()을 쓴다.
// 여기 사본이 있으면 새 검사를 붙일 때 빠뜨리고, 실제로 같은 검사가
// 화면마다 다른 이름('로샤'/'로르샤하')으로 보였다.
export { examTypeLabel } from '$lib/features/examination/common/exam-visual'

// 종합보고서 상태 표시
export const REPORT_STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  draft: { label: '초안 작성', dot: 'bg-gray-400', text: 'text-gray-600' },
  ai_generated: { label: 'AI 초안', dot: 'bg-purple-500', text: 'text-purple-600' },
  under_review: { label: '검토중', dot: 'bg-orange-500', text: 'text-orange-700' },
  confirmed: { label: '확인완료', dot: 'bg-green-500', text: 'text-green-600' },
  report_generated: { label: '보고서', dot: 'bg-indigo-500', text: 'text-indigo-600' },
  completed: { label: '완료', dot: 'bg-green-500', text: 'text-green-600' },
}
