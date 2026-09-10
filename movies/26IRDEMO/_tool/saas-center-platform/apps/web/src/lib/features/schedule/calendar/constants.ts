import { t, josa } from '$lib/ontology/terms'
// 날짜 범위 모드 (타이틀 행 우측)
export const DATE_RANGE_MODES = ['일간', '주간', '월간'] as const
export type DateRangeMode = (typeof DATE_RANGE_MODES)[number]

// 표현 방식 (일간 모드 전용, 필터 행 우측)
export const DISPLAY_MODES = ['장소별', '담당자별'] as const
export type DisplayMode = (typeof DISPLAY_MODES)[number]

// 세션 상태 옵션 (인라인 드롭다운용)
// 회기 상태는 예정/완료/취소 3단 — 노쇼는 내담자 출결에만 있는 사유다(전원 노쇼 = 회기 취소).
export const SESSION_STATUS_OPTIONS = [
  { value: 'scheduled', label: '예정' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' }
] as const

export {
  DEFAULT_OPERATING_HOURS,
  isOperatingHourForDay,
  isBreakHourForDay,
  getOperatingHoursForDate,
  isTimeOutsideOperatingHours,
  formatOperatingHoursRange,
  generateTimeSlots
} from '$lib/features/schedule/operating-hours'

export const REGISTER_SCHEDULE_OPTIONS = [
  {
    lable: '운영 일정',
    description: '센터 운영과 관련된 일정을 등록해요',
    linkTo: '/operation/receive'
  },
  {
    lable: '상담 일정',
    description: `${josa(t('subject'), '과/와')}의 상담 일정을 등록해요`,
    linkTo: '/counseling/receive'
  },
  {
    lable: '검사 일정',
    description: `${josa(t('subject'), '과/와')}의 검사 일정을 등록해요`,
    linkTo: '/assessment/receive'
  }
]

// Room별 색상 팔레트
export const ROOM_COLORS = [
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#2196F3', // Blue
  '#9C27B0', // Purple
  '#F44336', // Red
  '#00BCD4', // Cyan
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#E91E63', // Pink
  '#3F51B5' // Indigo
] as const
