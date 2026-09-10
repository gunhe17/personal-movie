export const SLIDE_DURATION = 280
export const FADE_DURATION = 200

export const INQUIRY_STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  in_progress: '처리 중',
  resolved: '처리 완료',
  closed: '종료'
}

/**
 * 문의 상태 배지 색 — `BadgeRectangle`의 tag 색 이름(§Colors > Tag).
 * 하드코딩 클래스(`bg-yellow-100 text-yellow-700`) 금지 — 배지 규격은 컴포넌트가 소유한다.
 * 상태색은 green·red·amber·gray 4계열 단일화 정본을 따른다(yellow → amber).
 */
export type InquiryBadgeColor = 'amber' | 'blue' | 'green' | 'gray'

export const INQUIRY_STATUS_COLOR: Record<string, InquiryBadgeColor> = {
  pending: 'amber',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'gray'
}

export const INQUIRY_TYPE_MAP: Record<string, string> = {
  '서비스 이용 문의': 'general',
  '결제/환불 문의': 'general',
  '기능 개선 요청': 'feature_request',
  '오류/버그 신고': 'technical',
  기타: 'other'
}

export const FAQ_TABS = [
  { value: 'all', label: '전체' },
  { value: 'getting_started', label: '시작하기' },
  { value: 'general', label: '일반' },
  { value: 'technical', label: '기술' },
  { value: 'feature', label: '기능' }
] as const

export type FaqTabValue = (typeof FAQ_TABS)[number]['value']
