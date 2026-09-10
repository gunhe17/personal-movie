/** 검사(Task) 상태 → 한글 라벨 (칩/사이드바 표시용) */
export const ASSESSMENT_STATUS_LABELS: Record<
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'completed'
  | 'refused'
  | 'cancelled',
  string
> = {
  pending: '진행전',
  in_progress: '진행중',
  submitted: '제출완료',
  completed: '완료',
  refused: '미실시',
  cancelled: '중단'
}

/** 검사 상태별 태그 스타일 (텍스트/배경 색상 — 드롭다운 칩·사이드바 검사 태그 공통) */
export const ASSESSMENT_STATUS_TAG_STYLES: Record<
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'completed'
  | 'refused'
  | 'cancelled',
  { text: string; bg: string }
> = {
  // 전 상태 tag 팔레트 매핑 (Web_Design.md §Status Badge — 상태 배지는 별도 색 없이
  // tag 팔레트를 재사용한다). 2026-08-19 hex 하드코딩 일괄 제거.
  //   pending→gray · in_progress→blue · completed→green · cancelled→red (정본 매핑)
  //   submitted→purple · refused→amber (정본에 매핑 없음 — 기존 색 계열 유지/근접값)
  pending: { text: 'var(--color-tag-gray-fg)', bg: 'var(--color-tag-gray-bg)' },
  in_progress: {
    text: 'var(--color-tag-blue-fg)',
    bg: 'var(--color-tag-blue-bg)'
  },
  submitted: {
    text: 'var(--color-tag-purple-fg)',
    bg: 'var(--color-tag-purple-bg)'
  },
  completed: {
    text: 'var(--color-tag-green-fg)',
    bg: 'var(--color-tag-green-bg)'
  },
  refused: {
    text: 'var(--color-tag-amber-fg)',
    bg: 'var(--color-tag-amber-bg)'
  },
  cancelled: { text: 'var(--color-tag-red-fg)', bg: 'var(--color-tag-red-bg)' }
}

/**
 * 검사 분류(assessment_type) → 카드 헤더 배경 색상.
 * 디자인 지정값(투사/지능/객관/발달). 토큰화 전까지 여기서 단일 관리한다.
 */
export const ASSESSMENT_CATEGORY_COLORS: Record<string, string> = {
  projective: '#FA6FD3', // 투사
  intelligence: '#28C4D0', // 지능
  objective: '#269FEF', // 객관
  developmental: '#7867F8' // 발달
}

/** 세분류(서버/목 데이터) → 4대 분류 정규화 */
const ASSESSMENT_CATEGORY_ALIASES: Record<string, string> = {
  cognitive: 'intelligence',
  perceptual: 'projective',
  attention: 'objective',
  behavioral: 'objective'
}

/** 미매핑 분류 폴백 색 (객관 블루) */
export const DEFAULT_ASSESSMENT_CATEGORY_COLOR =
  ASSESSMENT_CATEGORY_COLORS.objective

/** 검사 분류 문자열 → 카드 배경 색 (별칭 정규화 + 폴백) */
export function resolveCategoryColor(type?: string | null): string {
  const key = (type ?? '').toLowerCase()
  const normalized = ASSESSMENT_CATEGORY_ALIASES[key] ?? key
  return (
    ASSESSMENT_CATEGORY_COLORS[normalized] ?? DEFAULT_ASSESSMENT_CATEGORY_COLOR
  )
}

/** 검사 상태 → 서술형 텍스트 (사이드바/탭 표시용) */
export const ASSESSMENT_STATUS_DESCRIPTIONS: Record<
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'completed'
  | 'refused'
  | 'cancelled',
  string
> = {
  pending: '검사 대기 중입니다',
  in_progress: '검사 진행중입니다',
  submitted: '검사가 제출되었습니다. 확인 후 완료 처리해주세요.',
  completed: '검수가 완료되었습니다',
  refused: '미실시 처리된 검사입니다',
  cancelled: '중단된 검사입니다'
}

/** 취소/삭제 컨펌 모달 문구 */
export const ASSESSMENT_ACTION_DESCRIPTIONS = {
  cancel: '검사를 중단하면 진행이 멈추지만, 나중에 되돌릴 수 있어요.',
  delete: '검사를 삭제하면 모든 데이터가 영구적으로 제거되며 복구할 수 없어요.'
} as const

/** self_report 워크플로우 3단계 라벨 */
export const SELF_REPORT_STEPS = [
  { key: 'scoring', label: '채점 확인' },
  { key: 'results', label: '결과 보기' },
  { key: 'report', label: '보고서 생성' }
] as const

export type SelfReportStepKey = (typeof SELF_REPORT_STEPS)[number]['key']

/** external_service 워크플로우 2단계 라벨 */
export const EXTERNAL_SERVICE_STEPS = [
  { key: 'upload', label: '결과 업로드' },
  { key: 'results', label: '결과 보기' }
] as const

export type ExternalServiceStepKey =
  (typeof EXTERNAL_SERVICE_STEPS)[number]['key']

/**
 * self_report 타입에서 task 상태에 따른 현재 단계 (1-based).
 * - completed 또는 보고서 있음: 3 (보고서 생성)
 * - submitted: 1 (채점 확인부터 시작)
 * - 나머지: 1 (채점 확인 대기)
 */
export function getSelfReportActiveStep(
  status:
    | 'pending'
    | 'in_progress'
    | 'submitted'
    | 'completed'
    | 'refused'
    | 'cancelled',
  options?: { hasReportDocument?: boolean; hasReportPayload?: boolean }
): number {
  if (status === 'completed' || options?.hasReportDocument) return 3
  if (status === 'submitted' || options?.hasReportPayload) return 1
  return 1
}

/**
 * external_service 타입에서 task 상태에 따른 현재 단계 (1-based).
 * - pending / in_progress + report 없음: 1 (보고서 업로드)
 * - submitted / completed 또는 report_document_id 있음: 2 (결과 보기)
 */
export function getExternalServiceActiveStep(
  status: string,
  hasReportDocument: boolean
): number {
  if (hasReportDocument || status === 'submitted' || status === 'completed')
    return 2
  return 1
}
