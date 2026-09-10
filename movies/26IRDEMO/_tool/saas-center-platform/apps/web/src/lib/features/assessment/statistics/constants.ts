/**
 * 검사 통계 페이지 상수 정의
 */

// 기간 필터 옵션
export const PERIOD_OPTIONS = [
  { label: '일간', value: 'daily' },
  { label: '주간', value: 'weekly' },
  { label: '월간', value: 'monthly' }
] as const

export type PeriodType = (typeof PERIOD_OPTIONS)[number]['value']

// 통계 카드 타입
export const STATS_CARD_TYPES = {
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
} as const

// 통계 카드 라벨
export const STATS_CARD_LABELS = {
  [STATS_CARD_TYPES.COMPLETED]: '완료된 검사',
  [STATS_CARD_TYPES.IN_PROGRESS]: '진행중 검사',
  [STATS_CARD_TYPES.CANCELLED]: '취소된 검사',
  [STATS_CARD_TYPES.REJECTED]: '거부된 검사'
} as const

// 차트 색상
export const CHART_COLORS = {
  bar: '#4DC3D5',
  barHover: '#3BA8B8',
  grid: '#E5E7EB',
  text: '#6B7280'
} as const

// 도넛 차트 색상 팔레트
export const DONUT_CHART_COLORS = [
  '#4c87f6', // primary-400
  '#1395a1', // mint
  '#f47500', // orange
  '#a78bfa', // violet
  '#017750', // green
  '#69168c', // purple
  '#c70a89', // pink
  '#fdca01' // yellow
] as const
