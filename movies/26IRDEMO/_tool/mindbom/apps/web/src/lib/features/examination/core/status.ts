/**
 * 검사 상태머신 공통 술어 — 임상 워크플로 축.
 *
 *   in_progress → ai_draft_ready → under_review → confirmed
 *
 * 채점 방식(AI냐 규준표냐)과 무관하게 같은 경로를 쓴다. 초안을 무엇이
 * 만들었는지는 상태가 아니라 ai_analysis_jobs가 기록한다. 덕분에 AI 채점이
 * 없는 표준화 검사(MMPI·웩슬러 등)도 우회 없이 이 경로를 탄다.
 *
 * "어디까지 진행됐는가"는 이 축이 아니라 progress가 답한다(core/module.ts).
 */
import type { ExamStatus } from '../common/constants'

/** 아직 반응을 수집하는 중 — 기록 단계를 벗어나지 않았다 */
export function isCollecting(status: ExamStatus): boolean {
  return status === 'created' || status === 'in_progress'
}

/** 채점·초안이 준비돼 검토할 수 있는 단계 */
export function isReviewable(status: ExamStatus): boolean {
  return [
    'ai_draft_ready',
    'under_review',
    'confirmed',
    'report_generated',
    'completed'
  ].includes(status)
}

/**
 * 확정 이후의 상태들 — 이 집합을 화면에서 다시 적지 않는다.
 *
 * 목록 API(ExamItem)의 status는 서버 응답이라 string이라서, 좁힌 타입만
 * 받으면 화면이 캐스팅을 피하려고 배열을 재구현하게 된다. 그래서 술어는
 * string을 받는다 — 정본을 쓰는 쪽이 항상 더 쉬워야 한다.
 */
const CONFIRMED_STATUSES: ReadonlySet<string> = new Set([
  'confirmed',
  'report_generated',
  'completed'
])

/** 임상가가 확정한 이후 — 결과 열람·보고서 발행 가능 */
export function isConfirmed(status: ExamStatus | string): boolean {
  return CONFIRMED_STATUSES.has(status)
}

/**
 * 보고서 PDF를 내려받을 수 있는 상태.
 *
 * confirmed 이후는 전부 포함한다 — completed는 confirmed보다 더 진행된
 * 상태이므로 여기서 빠지면 "가장 끝난 검사만 PDF를 못 받는" 역전이 된다.
 * 실제로 SCT 결과 화면이 이 목록을 인라인으로 재구현하면서 completed를
 * 빠뜨려, 완료된 검사에 '검사 확정' 버튼이 다시 뜨는 회귀가 있었다.
 * (그 화면은 이 값을 "완료됐나" 판정으로도 재사용했다 — 두 개념은 다르다.)
 */
export function canDownloadReport(status: ExamStatus | string): boolean {
  return isConfirmed(status)
}
