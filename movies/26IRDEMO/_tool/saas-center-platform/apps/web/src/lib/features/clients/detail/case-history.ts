// ============================================================
// 내담자 상세 - 담당 이력 (상담/검사 케이스 통합)
// ============================================================
//
// 정규화 로직은 members 모듈의 case-history를 단일 소스로 재사용한다.
// (상담 케이스 ↔ 검사 케이스 → 단일 CaseHistoryItem, 날짜 그룹핑 등)
//
// 차이점은 데이터 소스뿐:
//   - 구성원: counselor 기준 (담당 상담사)
//   - 내담자: client 기준 (참여 내담자)
// 상담은 응답 스키마가 동일하므로 mapCounselingToHistory/toCounselingHistoryPage를
// 그대로 쓴다. 검사는 by-client 엔드포인트가 페이지네이션 없는 배열(CaseData[])을
// 반환하므로, 단일 페이지로 래핑하는 얇은 어댑터만 추가한다.

import type { CaseData } from '$lib/types/assessmentStatus'
import {
  mapAssessmentToHistory,
  type CaseHistoryPage
} from '$lib/features/members/case-history'

// members 모듈에서 재사용 (re-export)
export {
  mapCounselingToHistory,
  mapAssessmentToHistory,
  toCounselingHistoryPage,
  groupCaseHistoryByDate,
  CASE_HISTORY_SUBTABS,
  type CaseHistoryItem,
  type CaseHistoryKind,
  type CaseHistoryPage,
  type CaseHistoryGroup
} from '$lib/features/members/case-history'

/**
 * by-client 검사 응답(CaseData[]) → 단일 CaseHistoryPage.
 * 페이지네이션이 없으므로 전체를 한 페이지로 래핑(hasNext=false).
 * CaseData 형태라 기존 mapAssessmentToHistory를 그대로 재사용한다.
 */
export function toAssessmentByClientPage(
  items: CaseData[] | undefined
): CaseHistoryPage {
  const list = items ?? []
  return {
    items: list.map(mapAssessmentToHistory),
    hasNext: false,
    total: list.length
  }
}
