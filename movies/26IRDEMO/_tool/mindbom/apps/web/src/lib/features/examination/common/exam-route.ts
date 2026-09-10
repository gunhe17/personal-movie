import type { ExamType } from './constants'
import { getExamModule, isSupportedExamType } from '../core/registry'
import { gateFrom, resolveActiveStep } from '../core/module'
import type { ExamProgress } from '../core/module'

/**
 * 검사 진행 화면의 진입 경로.
 *
 * 어느 단계로 갈지는 진행 상황(progress)을 알아야 정할 수 있다. progress는
 * 상세 응답에만 실리므로 호출부가 그걸 갖고 있는지에 따라 갈린다:
 *
 *   - 상세 화면처럼 exam을 이미 받아 온 곳: progress를 넘기면 정확한 단계로 간다.
 *   - 목록·대시보드처럼 status만 있는 곳: 첫 단계로 보낸다. 도착한 뒤
 *     [step] 가드가 progress를 보고 열린 단계로 옮겨 준다.
 *
 * status만으로 단계를 고르지는 않는다 — 세 검사 모두 "수집 완료"를 status에
 * 남기지 않아서, 그렇게 고르면 아직 안 열린 단계를 골라 되돌려 보내진다.
 */
export function examProgressPath(
  examId: string,
  examType: ExamType | string,
  opts?: { status?: string; progress?: ExamProgress | null }
): string {
  const base = `/examinations/${examId}`
  /**
   * 미지원 검사는 갈 곳이 없다 — `/examinations/{id}` 자체에 페이지가 없다
   * (검사 상세 라우트는 진입점이 하나도 없어 삭제했다. 목록·직원 상세 모두
   * 진행 화면으로 직행한다).
   *
   * 그래서 호출부가 `isSupportedExamType`으로 먼저 걸러야 하고, 여기 도달했다면
   * 그 가드가 빠진 것이다. base를 돌려주면 404로 끝나 원인이 안 보이므로
   * 목록으로 되돌린다.
   */
  if (!isSupportedExamType(examType)) return '/examinations'

  const module = getExamModule(examType)
  const step = opts?.progress
    ? resolveActiveStep(module, gateFrom(opts.status, opts.progress))
    : module.steps[0]
  return `${base}/${step.key}`
}
