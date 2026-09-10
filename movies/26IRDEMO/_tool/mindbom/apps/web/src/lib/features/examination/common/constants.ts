import { LIST_PAGE_SIZE } from '$lib/features/common/filters'

export const EXAM_PAGE_SIZE = LIST_PAGE_SIZE

/**
 * 검사 타입 — 실제 정의는 레지스트리에 있다(등록된 모듈에서 파생).
 * 기존 import 경로를 유지하려고 여기서 re-export한다.
 */
import type { ExamType } from '../core/registry'
export type { ExamType }

/**
 * 검사의 임상 워크플로 상태.
 *
 * 'ai_analyzing'은 없다 — 분석은 상태가 아니라 작업이라서 서버의
 * ai_analysis_jobs 표로 옮겼다. 분석 중이라는 표시는 요청을 보낸 화면이
 * 자기 로컬 상태로 그린다.
 *
 * 마인드봄의 최종 상태는 'report_generated'다. 그 뒤의 '완료'는 운영
 * 플랫폼이 담당자 검수로 판정하는 별개 사건이라 우리 축에서 뺐다.
 * 'completed'는 **과거 데이터에만 존재**한다 — 새로 만들어지지 않지만
 * 서버가 그 값을 돌려줄 수 있으므로 타입에는 남긴다(표시·필터용).
 */
export type ExamStatus =
  | 'created'
  | 'in_progress'
  | 'ai_draft_ready'
  | 'under_review'
  | 'confirmed'
  | 'report_generated'
  /** @deprecated 과거 데이터 전용 — 새 전이는 만들지 않는다 */
  | 'completed'

// 검사 타입 라벨은 exam-visual.ts의 examTypeLabel() 하나로 통일했다.
// 여기 있던 EXAM_TYPE_LABELS는 EXAM_TYPE_VISUAL.label과 값이 어긋난 채
// 중복돼 있었다(같은 검사가 '로르샤하'와 '로샤'로 갈렸다). 소비처도 없었다.

// 상태 라벨·색은 exam-visual.ts의 EXAM_STATUS_VISUAL 하나로 통일했다.
// 여기 있던 EXAM_STATUS_LABELS / EXAM_STATUS_COLORS / EXAM_STATUS_TABS는
// 표기가 서로 어긋난 채 중복돼 있어 제거했다 (예: 같은 상태를 두고
// 'AI 초안완료'와 'AI 초안', orange와 violet이 공존했다).
