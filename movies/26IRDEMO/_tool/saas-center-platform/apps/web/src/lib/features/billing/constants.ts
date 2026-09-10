/**
 * 청구 관련 상수 및 타입 정의
 */

// ── Legacy (PaymentRecord 기반) ──
export const BILLING_STATUS = {
  pending: '청구 필요',
  completed: '청구 완료'
} as const

export type BillingStatusKey = keyof typeof BILLING_STATUS

// ── Billable 기반 ──
export const BILLABLE_STATUS = {
  draft: '임시',
  issued: '결제대기',
  paid: '결제완료',
  overdue: '연체'
} as const

export type BillableStatusKey = keyof typeof BILLABLE_STATUS

// 상태 배지 색은 상담·검사(BadgeRound)와 같은 state-* 토큰 계열을 쓴다.
// pending(대기) · done(완료) · canceled(문제) — Web_Design.md §Status Badge 정본 매핑.
export const BILLABLE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-state-pending-bg text-state-pending-text',
  issued: 'bg-state-pending-bg text-state-pending-text',
  paid: 'bg-state-done-bg text-state-done-text',
  overdue: 'bg-state-canceled-bg text-state-canceled-text'
} as const

export const BILLABLE_STATUS_OPTIONS = [
  { value: 'all', title: '전체' },
  // { value: 'draft', title: '임시' },
  { value: 'issued', title: '결제대기' },
  { value: 'paid', title: '결제완료' },
  // unbilled는 청구서 상태가 아니라 "아직 청구서가 없는 세션" 탭 —
  // 목록 데이터가 today-missing 엔드포인트로 갈린다 (+page.svelte isUnbilled 분기).
  // 청구서 진행 순서(전체 → 결제대기 → 결제완료) 뒤에 두어, 상태 사다리와 성격이
  // 다른 탭이 그 사다리 사이에 끼지 않게 한다.
  { value: 'unbilled', title: '미청구' }
  // { value: 'overdue', title: '연체' }
]

/** 청구 대상 유형 필터 — 기본은 전체보기 */
export const BILLABLE_TYPE_OPTIONS = [
  { value: 'all', title: '전체 유형' },
  { value: 'counseling', title: '상담' },
  { value: 'assessment', title: '검사' }
]

export const BILLING_STATUS_OPTIONS = [
  { value: 'all', title: '전체' },
  { value: 'pending', title: '청구 필요' },
  { value: 'completed', title: '청구 완료' }
]

export const MODAL_SIZES = {
  billing: { customWidth: 540 },
  billableCreate: { customWidth: 640 },
  // 영수증 모달 폭 500 = Figma 9859:338916 프레임 기준 (좌우 패딩 24 → 콘텐츠 452)
  billableDetail: { customWidth: 500, isReceipt: true }
}

export const DEFAULT_PAGE_SIZE = 20
export const SEARCH_DEBOUNCE_DELAY = 300

export const SORT_OPTIONS = [
  { value: 'desc', title: '최신순' },
  { value: 'asc', title: '오래된순' }
] as const

export const RELATED_TYPE_LABELS: Record<string, string> = {
  counseling_session: '상담',
  counseling_case: '상담 패키지',
  assessment_session: '검사',
  assessment_case: '검사 패키지',
  schedule: '일정'
} as const
