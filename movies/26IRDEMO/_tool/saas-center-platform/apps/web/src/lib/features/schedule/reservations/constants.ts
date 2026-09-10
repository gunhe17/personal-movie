import { t } from '$lib/ontology/terms'
/**
 * 예약 현황 페이지 상수
 */

export const RESERVATION_TABS = ['pending', 'confirmed', 'cancelled'] as const

export type ReservationTab = (typeof RESERVATION_TABS)[number]

export const RESERVATION_TAB_LABELS: Record<ReservationTab, string> = {
  pending: '대기',
  confirmed: '확정',
  cancelled: '반려'
}

// 검색 placeholder는 목록 화면 공통 문형 — "~을 입력해주세요"(명사 나열이 아닌 문장).
// 도메인 어휘는 리터럴 금지 → t('subject') 경유
export const RESERVATION_SEARCH_PLACEHOLDER = `${t('subject')}·담당자 이름을 입력해주세요`
